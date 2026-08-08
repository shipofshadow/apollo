const fs = require('fs');
const file = 'src/pages/admin/AdminInquiryDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
    fetchShopClosedDatesApi,\n  fetchInquiryChecklistsApi\n} from '../../services/api';,
    fetchShopClosedDatesApi,\n  fetchInquiryChecklistsApi,\n  sendInquiryChecklistPhaseApi\n} from '../../services/api';
);
content = content.replace(
  import type { ShopDayHours } from '../../types';,
  import type { ShopDayHours, Inquiry, Service } from '../../types';\nimport { INQUIRY_STAGES } from '../../types';
);

// 2. Remove Inquiry Type
content = content.replace(/type Inquiry = \{[\s\S]*?serviceId\?: number \| null;\n\};\n/, '');

// 3. Update Services Type
content = content.replace(
  const [services, setServices] = useState<any[]>([]);,
  const [services, setServices] = useState<Service[]>([]);
);

// 4. Update loadChecklistsState
content = content.replace(
  loadChecklistsState();\n      } catch (err) {,
  wait loadChecklistsState();\n      } catch (err) {
);

// 5. handleStatusChange boolean return
content = content.replace(
  const handleStatusChange = async (newStatus: string) => {\n    if (!token || !inquiry) return;\n    setStatusLoading(true);\n    try {\n      const res = await updateInquiryStatusApi(token, inquiry.id, newStatus);\n      setInquiry({ ...inquiry, status: res.inquiry.status });\n      showToast('Status updated.', 'success');\n      // Refresh activities\n      const activitiesRes = await fetchInquiryActivityApi(token, String(id));\n      setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);\n    } catch (err) {\n      showToast((err as Error).message, 'error');\n    } finally {\n      setStatusLoading(false);\n    }\n  };,
  const handleStatusChange = async (newStatus: string): Promise<boolean> => {\n    if (!token || !inquiry) return false;\n    setStatusLoading(true);\n    try {\n      const res = await updateInquiryStatusApi(token, inquiry.id, newStatus);\n      setInquiry({ ...inquiry, status: res.inquiry.status });\n      showToast('Status updated.', 'success');\n      // Refresh activities\n      const activitiesRes = await fetchInquiryActivityApi(token, String(id));\n      setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);\n      return true;\n    } catch (err) {\n      showToast((err as Error).message, 'error');\n      return false;\n    } finally {\n      setStatusLoading(false);\n    }\n  };
);

// 6. handleServiceChange check
const oldHandleService =   const handleServiceChange = async (serviceId: string, serviceName: string) => {
    if (!token || !inquiry) return;
    const sId = serviceId ? parseInt(serviceId, 10) : null;
    requestConfirmation(
      {
        title: 'Change Linked Service',
        message: \Are you sure you want to link this inquiry to "\"? This will change the active checklist template.\,
        confirmLabel: 'Confirm',
        tone: 'default',
      },
      async () => {
        try {
          setServicesLoading(true);
          const res = await updateInquiryServiceIdApi(token, inquiry.id, sId);
          setInquiry(res.inquiry);
          showToast('Service linked successfully.', 'success');
          const activitiesRes = await fetchInquiryActivityApi(token, String(id));
          setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);
          setActivityPage(0);
        } catch (err) {
          showToast((err as Error).message, 'error');
        } finally {
          setServicesLoading(false);
        }
      }
    );
  };;
const newHandleService =   const handleServiceChange = async (serviceId: string, serviceName: string) => {
    if (!token || !inquiry) return;
    const sId = serviceId ? parseInt(serviceId, 10) : null;
    const updateService = async () => {
      try {
        setServicesLoading(true);
        const res = await updateInquiryServiceIdApi(token, inquiry.id, sId);
        setInquiry(res.inquiry);
        showToast('Service linked successfully.', 'success');
        const activitiesRes = await fetchInquiryActivityApi(token, String(id));
        setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);
        setActivityPage(0);
      } catch (err) {
        showToast((err as Error).message, 'error');
      } finally {
        setServicesLoading(false);
      }
    };
    if (inquiry.serviceId) {
      requestConfirmation({
        title: 'Change Linked Service',
        message: \Are you sure you want to link this inquiry to "\"? This will change the active checklist template.\,
        confirmLabel: 'Confirm',
        tone: 'default',
      }, updateService);
    } else {
      updateService();
    }
  };;
content = content.replace(oldHandleService, newHandleService);

// 7. Click Outside and Escape for Status Dropdown
const oldStateDec =   const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);;
const newStateDec =   const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStatusDropdownOpen(false);
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isStatusDropdownOpen]);;
content = content.replace(oldStateDec, newStateDec);

// 8. Wrap Status Dropdown
const oldDropdown = <div className="relative z-20">;
const newDropdown = <div ref={statusDropdownRef} className="relative z-20">;
content = content.replace(oldDropdown, newDropdown);

// 9. Blob Cleanup in handlePreviewPdf
const oldPreviewPdf =   const handlePreviewPdf = async (phase: string = 'after') => {
    if (!token || !inquiry) return;
    setPreviewLoading(phase);
    try {
      const blob = await generateInquiryChecklistPdfApi(token, inquiry.id.replace('inq-', ''), phase);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error(err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
    } finally {
      setPreviewLoading(null);
    }
  };;
const newPreviewPdf =   const blobUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const handlePreviewPdf = async (phase: string = 'after') => {
    if (!token || !inquiry) return;
    setPreviewLoading(phase);
    try {
      const blob = await generateInquiryChecklistPdfApi(token, inquiry.id.replace('inq-', ''), phase);
      const url = URL.createObjectURL(blob);
      blobUrlsRef.current.push(url);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error(err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
    } finally {
      setPreviewLoading(null);
    }
  };;
content = content.replace(oldPreviewPdf, newPreviewPdf);

// 10. Fix dynamic import in handleSendPdf
content = content.replace(
  const { sendInquiryChecklistPhaseApi } = await import('../../services/api');\n      await sendInquiryChecklistPhaseApi(token, inquiry.id.replace('inq-', ''), phase);,
  wait sendInquiryChecklistPhaseApi(token, inquiry.id.replace('inq-', ''), phase);
);

// 11. JSX Spread Bug Fix
const jsxSpreadOld = {
              ...(() => {
                const linkedSvc = services.find(s => s.id === inquiry.serviceId);
                return (;
const jsxSpreadNew = {(() => {
                const linkedSvc = services.find(s => s.id === inquiry.serviceId);
                return (;
const jsxSpreadEndOld =                 );
              })()
            };
const jsxSpreadEndNew =                 );
              })()};
content = content.replace(jsxSpreadOld, jsxSpreadNew).replace(jsxSpreadEndOld, jsxSpreadEndNew);

// 12. Fix (inquiry as any).serviceId
content = content.replace(/\(inquiry as any\)\.serviceId/g, 'inquiry.serviceId');

// 13. Fix "Auth required" header
content = content.replace(
  // Auth required,
  {confirmDialog.tone === 'danger' ? '// Action Required' : '// Please Confirm'}
);

// 14. Magic Strings STAGES
content = content.replace(/const stages = \['pending', 'confirmed', 'in_progress', 'completed'\];/g, 'const stages = INQUIRY_STAGES;');
content = content.replace(/\{\['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'\]\.map\(/g, '{[...INQUIRY_STAGES, \\'cancelled\\'].map(');

// 15. handleStatusChange Complete check
content = content.replace(
  sync () => {
                        await handleStatusChange('completed');
                        setActiveChecklistPhase('after');
                      },
  sync () => {
                        const success = await handleStatusChange('completed');
                        if (success) setActiveChecklistPhase('after');
                      }
);

fs.writeFileSync(file, content, 'utf8');
console.log('Refactor complete!');
