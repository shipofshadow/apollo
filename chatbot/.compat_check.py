import json
import uuid
import httpx

base='http://127.0.0.1:8000'
client=httpx.Client(timeout=20.0)
results=[]

def add(name, ok, evidence):
    results.append({'check':name,'result':'PASS' if ok else 'FAIL','evidence':evidence})

# 1 health
try:
    r=client.get(f'{base}/health')
    add('GET /health', r.status_code==200 and r.json()=={'status':'ok'}, f"{r.status_code} {r.text}")
except Exception as e:
    add('GET /health', False, str(e))

# 2 flows list
r=client.get(f'{base}/flows')
add('GET /flows returns array', r.status_code==200 and isinstance(r.json(), list), f"{r.status_code} type={type(r.json()).__name__}")

# 3 create test flow with quick reply/card/http/coercions
flow_payload={
  'name':'Compat Test Flow',
  'description':'compat checks',
  'is_active':False,
  'flow_json':json.dumps({
    'id':'compat_test',
    'name':'Compat Test Flow',
    'trigger_keywords':['hello','start','hi'],
    'nodes':[ 
      {'id':'start','message':'Choose path','input_type':'quick_reply','options':[{'label':'Services','value':'services','next':'services'},{'label':'Book','value':'book','next':'collect'}],'next':None},
      {'id':'services','message':'Service cards','input_type':'none','http_request':{'method':'GET','url':f'{base}/api/manychat/menu','response_variable':'menu','render_cards':True},'next':'start'},
      {'id':'collect','message':'Enter service id','input_type':'text','variable':'service_id','validation':{'type':'required'},'next':'collect_variation'},
      {'id':'collect_variation','message':'Enter variant id','input_type':'text','variable':'variant_id','validation':{'type':'required'},'next':'collect_name'},
      {'id':'collect_name','message':'Enter variant name','input_type':'text','variable':'variation_name','validation':{'type':'required'},'next':'collect_csv'},
      {'id':'collect_csv','message':'Enter comma items','input_type':'text','variable':'tags','validation':{'type':'required'},'next':'collect_vehicle'},
      {'id':'collect_vehicle','message':'Enter vehicle info','input_type':'text','variable':'vehicleInfo','validation':{'type':'required'},'next':'collect_make'},
      {'id':'collect_make','message':'Enter vehicle make','input_type':'text','variable':'vehicleMake','validation':{'type':'required'},'next':'collect_model'},
      {'id':'collect_model','message':'Enter vehicle model','input_type':'text','variable':'vehicleModel','validation':{'type':'required'},'next':'collect_year'},
      {'id':'collect_year','message':'Enter vehicle year','input_type':'text','variable':'vehicleYear','validation':{'type':'required'},'next':'collect_date'},
      {'id':'collect_date','message':'Enter date','input_type':'text','variable':'appointmentDate','validation':{'type':'required'},'next':'collect_time'},
      {'id':'collect_time','message':'Enter appointment time','input_type':'text','variable':'appointmentTime','validation':{'type':'required'},'next':'post_booking'},
      {'id':'post_booking','message':'Posting booking payload','input_type':'none','http_request':{
        'method':'POST','url':'https://httpbin.org/post','response_variable':'booking_response','body':{
          'serviceId':{'$int':'{service_id}'},
          'selectedVariations':{'$variations':{'serviceId':'{service_id}','variationId':'{variant_id}','variationName':'{variation_name}'}},
          'tags':{'$csv':'{tags}'},
          'vehicleInfo':'{vehicleInfo}',
          'vehicleMake':'{vehicleMake}',
          'vehicleModel':'{vehicleModel}',
          'vehicleYear':'{vehicleYear}',
          'appointmentDate':'{appointmentDate}',
          'appointmentTime':'{appointmentTime}'
        }
      },'next':'done'},
      {'id':'done','message':'Done','input_type':'none','next':None}
    ]
  })
}
cr=client.post(f'{base}/flows', json=flow_payload)
created_ok=cr.status_code==201 and isinstance(cr.json().get('flow_json'), str)
flow_id=cr.json().get('id') if cr.status_code==201 else None
add('POST /flows creates flow_json string', created_ok, f"{cr.status_code} id={flow_id}")

# 4 put flow update
ur=client.put(f'{base}/flows/{flow_id}', json={'flow_json':flow_payload['flow_json']}) if flow_id else None
add('PUT /flows/{id} updates flow_json', bool(ur and ur.status_code==200 and isinstance(ur.json().get('flow_json'), str)), f"{ur.status_code if ur else 'n/a'}")

# 5 activate
ar=client.post(f'{base}/flows/{flow_id}/activate') if flow_id else None
others=client.get(f'{base}/flows').json() if flow_id else []
active_count=sum(1 for f in others if f.get('is_active'))
add('POST /flows/{id}/activate single-active', bool(ar and ar.status_code==200 and ar.json().get('is_active') and active_count==1), f"activate={ar.status_code if ar else 'n/a'} active_count={active_count}")

# 6 chat happy path
sid=str(uuid.uuid4())
s1=client.post(f'{base}/chat/send', json={'session_id':sid,'message':'hello','message_type':'text'})
shape_ok=False
if s1.status_code==200:
    data=s1.json()
    shape_ok=isinstance(data.get('messages'),list) and data.get('status') in ['bot','human','closed'] and data.get('session_id')==sid
    if data.get('messages'):
        m=data['messages'][0]
        shape_ok=shape_ok and ('content' in m and 'message_type' in m and 'metadata' in m)
add('POST /chat/send happy-path response shape', shape_ok, f"{s1.status_code} body={s1.text[:220]}")

h=client.get(f'{base}/chat/history/{sid}')
history_ok=h.status_code==200 and isinstance(h.json(),list) and len(h.json())>=1
add('GET /chat/history persists messages', history_ok, f"{h.status_code} count={len(h.json()) if h.status_code==200 else 0}")

# 7 quick reply + card
q=client.post(f'{base}/chat/send', json={'session_id':sid,'message':'services','message_type':'text'})
qr_ok=False
card_ok=False
if q.status_code==200:
    msgs=q.json().get('messages',[])
    qr_ok=any(m.get('message_type')=='quick_reply' and isinstance((m.get('metadata') or {}).get('options'), list) for m in msgs)
    card_ok=any(m.get('message_type')=='card' and isinstance((m.get('metadata') or {}).get('cards'), list) for m in msgs)
add('Quick reply message_type/options', qr_ok, f"{q.status_code} types={[m.get('message_type') for m in q.json().get('messages',[])] if q.status_code==200 else []}")
add('Card node returns metadata.cards', card_ok, f"{q.status_code} body={q.text[:280]}")

# 8 coercions and booking payload capture
sid2=str(uuid.uuid4())
client.post(f'{base}/chat/send', json={'session_id':sid2,'message':'hello','message_type':'text'})
client.post(f'{base}/chat/send', json={'session_id':sid2,'message':'book','message_type':'text'})
for msg in ['1','1','Synthetic Oil','a,b,c','SUV Full','Toyota','Corolla','2024','2026-04-15','09:30 AM']:
    client.post(f'{base}/chat/send', json={'session_id':sid2,'message':msg,'message_type':'text'})

# fetch session data indirectly via history then conversations detail
conv_detail=client.get(f'{base}/admin/conversations/{sid2}')
coercion_ok=False
booking_payload_ok=False
if conv_detail.status_code==200:
    messages=conv_detail.json().get('messages',[])
    # look for raw http response saved in variables not messages; so query users endpoint
    us=client.get(f'{base}/users/{sid2}')
    if us.status_code==200:
        vars_json=us.json().get('variables_json','{}')
        vars_obj=json.loads(vars_json)
        posted=(vars_obj.get('booking_response') or {}).get('json',{}) if isinstance(vars_obj.get('booking_response'), dict) else {}
        coercion_ok=(posted.get('serviceId')==1 and posted.get('tags')==['a','b','c'] and isinstance(posted.get('selectedVariations'), list) and posted.get('selectedVariations') and posted['selectedVariations'][0].get('serviceId')=='1' and posted['selectedVariations'][0].get('variationId')=='1')
        booking_payload_ok=all(k in posted for k in ['vehicleInfo','vehicleMake','vehicleModel','vehicleYear','appointmentDate','appointmentTime','selectedVariations']) and posted.get('appointmentTime')=='09:30 AM'
add('$int/$csv/$variations + nested interpolation', coercion_ok, 'checked user session booking_response.json payload')
add('Booking payload vehicle/selectedVariations/time compatibility', booking_payload_ok, 'checked user session booking_response.json payload')

# 9 handoff/admin
sid3=str(uuid.uuid4())
client.post(f'{base}/chat/send', json={'session_id':sid3,'message':'hello','message_type':'text'})
to=client.post(f'{base}/admin/takeover/{sid3}')
rep=client.post(f'{base}/admin/reply/{sid3}', json={'message':'Human here'})
hist3=client.get(f'{base}/chat/history/{sid3}')
rel=client.post(f'{base}/admin/release/{sid3}')
release_reset=False
if rel.status_code==200:
    us=client.get(f'{base}/users/{sid3}')
    release_reset=(us.status_code==200 and us.json().get('current_node_id') is None)
add('POST /admin/takeover sets human', to.status_code==200 and to.json().get('status')=='human', f"{to.status_code} {to.text[:120]}")
add('POST /admin/reply stores human message', rep.status_code==201 and rep.json().get('sender')=='human', f"{rep.status_code}")
add('History includes human reply', hist3.status_code==200 and any(m.get('sender')=='human' for m in hist3.json()), f"{hist3.status_code} count={len(hist3.json()) if hist3.status_code==200 else 0}")
add('POST /admin/release sets bot + reset', rel.status_code==200 and rel.json().get('status')=='bot' and release_reset, f"{rel.status_code} reset={release_reset}")

# 10 admin views
cv=client.get(f'{base}/admin/conversations')
detail=client.get(f'{base}/admin/conversations/{sid3}')
cv_ok=False
detail_ok=False
if cv.status_code==200 and isinstance(cv.json(), list) and cv.json():
    sample=cv.json()[0]
    cv_ok=('last_message' in sample)
if detail.status_code==200:
    detail_ok=isinstance(detail.json().get('messages'), list)
add('GET /admin/conversations summary last_message', cv_ok, f"{cv.status_code} len={len(cv.json()) if cv.status_code==200 else 0}")
add('GET /admin/conversations/{session_id} detail+messages', detail_ok, f"{detail.status_code}")

# 11 manychat
menu=client.get(f'{base}/api/manychat/menu')
var=client.post(f'{base}/api/manychat/variants', json={'service_id':1})
menu_ok=menu.status_code==200 and menu.json().get('version')=='v2' and menu.json().get('content',{}).get('type')=='gallery'
var_ok=var.status_code==200 and var.json().get('version')=='v2' and var.json().get('content',{}).get('type')=='gallery'
buttons_ok=False
if var_ok:
    elems=var.json().get('content',{}).get('elements',[])
    if elems:
        payload=elems[0].get('buttons',[{}])[0].get('payload','')
        try:
            p=json.loads(payload)
            buttons_ok=all(k in p for k in ['serviceId','variationId','variationName'])
        except Exception:
            buttons_ok=False
add('GET /api/manychat/menu v2 gallery', menu_ok, f"{menu.status_code}")
add('POST /api/manychat/variants v2 gallery', var_ok, f"{var.status_code}")
add('ManyChat buttons include drilldown/booking payload', buttons_ok, 'parsed first variant button payload')

# 12 delete non-active test flow
# create another flow and ensure non-active delete works
f2=client.post(f'{base}/flows', json={'name':'Delete Me','description':'tmp','flow_json':flow_payload['flow_json'],'is_active':False})
del_ok=False
if f2.status_code==201:
    fid=f2.json()['id']
    d=client.delete(f'{base}/flows/{fid}')
    del_ok=(d.status_code==204)
add('DELETE /flows/{id} non-active flow', del_ok, f"create={f2.status_code}")

# 13 CORS preflight
opt=client.options(f'{base}/chat/send', headers={'Origin':'http://localhost:5173','Access-Control-Request-Method':'POST'})
cors_ok=opt.status_code in [200,204] and ('access-control-allow-origin' in opt.headers)
add('CORS preflight frontend origin', cors_ok, f"{opt.status_code} ACO={opt.headers.get('access-control-allow-origin')}")

print(json.dumps(results, indent=2))
