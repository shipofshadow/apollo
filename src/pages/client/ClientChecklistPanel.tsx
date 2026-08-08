import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { fetchInquiryChecklistsApi } from '../../services/api';
import type { InquiryChecklist } from '../../services/api';

interface ClientChecklistPanelProps {
  inquiryId: string;
  token: string;
}

export default function ClientChecklistPanel({ inquiryId, token }: ClientChecklistPanelProps) {
  const [checklists, setChecklists] = useState<Record<string, InquiryChecklist | null>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadChecklists();
  }, [inquiryId]);

  const loadChecklists = async () => {
    try {
      setLoading(true);
      const data = await fetchInquiryChecklistsApi(token, inquiryId);
      setChecklists(data);
      // Auto expand submitted ones
      const newExpanded = { ...expanded };
      if (data.before?.submittedAt) newExpanded.before = true;
      if (data.after?.submittedAt) newExpanded.after = true;
      setExpanded(newExpanded);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (phase: string) => {
    setExpanded(prev => ({ ...prev, [phase]: !prev[phase] }));
  };

  const renderPhase = (phase: string, title: string) => {
    const list = checklists[phase];
    if (!list || !list.submittedAt) return null; // Only show submitted checklists to clients

    const isExp = !!expanded[phase];

    return (
      <div key={phase} className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => toggleExpand(phase)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-900/30 transition-colors border-b border-gray-800"
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-orange" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-400 bg-green-500/10 px-2 py-1 rounded">
              <CheckCircle className="w-3 h-3" /> Verified
            </span>
            {isExp ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </button>

        {isExp && (
          <div className="px-6 py-5">
            <div className="text-[10px] font-mono text-gray-500 mb-6 pb-4 border-b border-gray-800/50">
              Submitted on {new Date(list.submittedAt).toLocaleString()} by {list.installerName || 'Technician'}
            </div>
            
            <div className="space-y-4">
              {list.responses.map(resp => (
                <div key={resp.id} className="flex gap-4 p-3 bg-black/20 rounded border border-gray-800/50">
                  <div className="shrink-0 mt-0.5">
                    {resp.isChecked ? (
                      <div className="w-5 h-5 rounded bg-brand-orange/20 border border-brand-orange flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-brand-orange" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded border border-gray-700" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm ${resp.isChecked ? 'text-gray-200 font-medium' : 'text-gray-500'}`}>{resp.item.label}</p>
                    {resp.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic border-l-2 border-gray-700 pl-2">{resp.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {list.generalNotes && (
              <div className="mt-6 pt-4 border-t border-gray-800">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">General Notes</p>
                <p className="text-sm text-gray-300 leading-relaxed">{list.generalNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="py-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-orange" /></div>;
  }

  if (!checklists.before?.submittedAt && !checklists.after?.submittedAt) {
    return null;
  }

  return (
    <div className="mt-8">
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Quality Assurance Checklists</h3>
      {renderPhase('before', 'Before Installation Checklist')}
      {renderPhase('after', 'After Installation Checklist')}
    </div>
  );
}
