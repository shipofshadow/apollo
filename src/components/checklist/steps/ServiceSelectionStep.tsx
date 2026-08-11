import { useEffect, useState } from 'react';
import { Package, Layers, Plus, Loader2, Sparkles, Wrench, CheckCircle2 } from 'lucide-react';
import { fetchServicesApi } from '../../../services/api';
import type { Service, ServiceVariation } from '../../../types';
import type { ChecklistWizardState } from '../types';

interface Props {
  state: ChecklistWizardState;
  onChange: (service: ChecklistWizardState['service']) => void;
}

export default function ServiceSelectionStep({ state, onChange }: Props) {
  const { service } = state;

  const [dbServices, setDbServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch services dynamically from the database
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchServicesApi(null)
      .then((res) => {
        if (!isMounted) return;
        const list = res.services || [];
        setDbServices(list);

        // Auto-select first database service if none selected yet
        if (list.length > 0 && !service.serviceId && !service.type && !service.isCustom) {
          const first = list[0];
          const defaultVar = first.variations && first.variations.length > 0 ? first.variations[0] : null;
          const detectedType = detectCategoryType(first);

          onChange({
            ...service,
            type: detectedType,
            serviceId: String(first.id),
            serviceName: first.title,
            variationId: defaultVar ? String(defaultVar.id) : null,
            variationName: defaultVar ? defaultVar.name : '',
            isCustom: false,
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load DB services:', err);
        setError('Could not connect to services database. Custom entry enabled.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function detectCategoryType(s: Service): 'headlights' | 'headunit' {
    const titleLower = s.title.toLowerCase();
    const catLower = (s.category || '').toLowerCase();
    const slugLower = s.slug.toLowerCase();

    if (
      catLower.includes('headlight') ||
      catLower.includes('lighting') ||
      titleLower.includes('headlight') ||
      titleLower.includes('projector') ||
      slugLower.includes('headlight')
    ) {
      return 'headlights';
    }
    return 'headunit';
  }

  // Handle clicking a service card fetched from DB
  const handleSelectDbService = (s: Service) => {
    const defaultVar = s.variations && s.variations.length > 0 ? s.variations[0] : null;
    const catType = detectCategoryType(s);

    onChange({
      ...service,
      type: catType,
      serviceId: String(s.id),
      serviceName: s.title,
      variationId: defaultVar ? String(defaultVar.id) : null,
      variationName: defaultVar ? defaultVar.name : '',
      isCustom: false,
    });
  };

  // Handle selecting variation from DB service
  const handleSelectDbVariation = (selectedServiceObj: Service, varIdStr: string) => {
    if (varIdStr === 'custom') {
      onChange({
        ...service,
        variationId: 'custom',
        variationName: service.customVariation || '',
      });
      return;
    }

    if (!selectedServiceObj.variations) return;
    const vObj = selectedServiceObj.variations.find((v: ServiceVariation) => String(v.id) === varIdStr) || null;
    if (vObj) {
      onChange({
        ...service,
        variationId: String(vObj.id),
        variationName: vObj.name,
      });
    }
  };

  const toggleCustomMode = (isCustom: boolean) => {
    onChange({
      ...service,
      isCustom,
      ...(isCustom
        ? {
            customName: service.customName || service.serviceName,
            customVariation: service.customVariation || service.variationName,
          }
        : {}),
    });
  };

  const selectedServiceObj = dbServices.find((s) => String(s.id) === service.serviceId) || null;

  return (
    <div className="space-y-6 font-sans">
      <div className="space-y-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
          STEP 4 OF {state.inspectionMode === 'both' ? '8' : '7'}
        </span>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
          Select Service &amp; Model
        </h2>
        <p className="text-xs text-gray-400">
          Services and variations are dynamically linked from the shop database.
        </p>
      </div>

      {/* Mode Header Bar */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
        <div className="flex items-center gap-2 font-mono text-xs text-white uppercase font-bold">
          <Package className="w-4 h-4 text-brand-orange" />
          <span>DATABASE SERVICE CATALOG</span>
        </div>

        <button
          type="button"
          onClick={() => toggleCustomMode(!service.isCustom)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-brand-orange bg-[#121212] text-xs font-mono font-bold text-brand-orange transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{service.isCustom ? 'Use DB Catalog' : 'Custom Service Entry'}</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-3 text-xs font-mono text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
          <span>Fetching service offerings from database...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-xl text-xs font-mono text-red-300">
          {error}
        </div>
      ) : !service.isCustom ? (
        <div className="space-y-6">
          {/* Dynamic Service Selection Cards (Fetched directly from DB) */}
          <div className="space-y-3">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
              Select Database Service Offering <span className="text-brand-orange">*</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dbServices.map((s) => {
                const isSelected = String(s.id) === service.serviceId;
                const catType = detectCategoryType(s);

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectDbService(s)}
                    className={`p-5 rounded-2xl border text-left transition-all duration-300 relative group cursor-pointer flex flex-col justify-between space-y-4 shadow-xl ${
                      isSelected
                        ? 'bg-[#161616] border-brand-orange ring-2 ring-brand-orange/40 shadow-brand-orange/10'
                        : 'bg-brand-darker border-gray-800/80 hover:border-gray-700 hover:bg-[#141414]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-brand-orange text-white border-brand-orange shadow-lg'
                          : 'bg-brand-dark border-gray-800 text-brand-orange group-hover:scale-105'
                      }`}>
                        {catType === 'headlights' ? <Sparkles className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
                      </div>

                      {isSelected && (
                        <span className="text-xs text-brand-orange font-bold font-mono uppercase bg-brand-orange/10 border border-brand-orange/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-display font-black text-white uppercase tracking-wide">
                        {s.title}
                      </h3>
                      {s.description && (
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {s.description}
                        </p>
                      )}
                    </div>

                    {s.variations && s.variations.length > 0 && (
                      <div className="text-[11px] font-mono text-gray-500 pt-1 border-t border-gray-800/60">
                        {s.variations.length} package variations available
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Variation Dropdown & Custom Variation Input linked to selected DB Service */}
          {selectedServiceObj && (
            <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-6 shadow-xl space-y-4 font-sans">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-brand-orange" /> Package Variation for "{selectedServiceObj.title}" <span className="text-brand-orange">*</span>
                </label>
                <span className="text-[10px] font-mono text-gray-500 uppercase">Catalog &amp; Custom Options</span>
              </div>

              <select
                value={service.variationId || ''}
                onChange={(e) => handleSelectDbVariation(selectedServiceObj, e.target.value)}
                className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm cursor-pointer font-mono"
              >
                <option value="" disabled>Select package variation...</option>
                {selectedServiceObj.variations && selectedServiceObj.variations.map((v: ServiceVariation) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.price ? `(${v.price})` : ''}
                  </option>
                ))}
                <option value="custom">✨ + Add Custom Package Variation...</option>
              </select>

              {/* Custom Variation Input Field */}
              {service.variationId === 'custom' && (
                <div className="space-y-2 pt-2 border-t border-gray-800/80">
                  <label htmlFor="custom-variation-field" className="block text-xs font-mono font-bold uppercase tracking-wider text-brand-orange flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Specify Custom Package Variation / Specs <span className="text-brand-orange">*</span>
                  </label>
                  <input
                    id="custom-variation-field"
                    type="text"
                    value={service.variationName || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange({
                        ...service,
                        variationId: 'custom',
                        variationName: val,
                        customVariation: val,
                      });
                    }}
                    placeholder='e.g. 10.1" QLED 8GB RAM + 128GB Storage + 360° Cam Package'
                    className="w-full bg-black/60 border border-brand-orange/60 rounded-lg p-3 text-white placeholder-gray-500 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-mono"
                  />
                  <p className="text-[11px] text-gray-400 font-mono">
                    This custom package variation will be saved in the database submission payload and printed on PDF reports.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Custom Entry Form */
        <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-6 shadow-xl space-y-5 font-sans">
          <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-xs font-mono text-amber-300">
            Custom Entry Mode (Manual service &amp; model specification):
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
              Service Category <span className="text-brand-orange">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <button
                type="button"
                onClick={() => onChange({ ...service, type: 'headlights' })}
                className={`p-3 rounded-lg border text-center font-bold cursor-pointer ${
                  service.type === 'headlights' ? 'bg-[#161616] border-brand-orange text-brand-orange' : 'bg-[#121212] border-gray-800 text-gray-400'
                }`}
              >
                Headlights Retrofit
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...service, type: 'headunit' })}
                className={`p-3 rounded-lg border text-center font-bold cursor-pointer ${
                  service.type === 'headunit' ? 'bg-[#161616] border-brand-orange text-brand-orange' : 'bg-[#121212] border-gray-800 text-gray-400'
                }`}
              >
                Android Head Unit
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
              Custom Service / Model <span className="text-brand-orange">*</span>
            </label>
            <input
              type="text"
              required
              value={service.customName}
              onChange={(e) => onChange({ ...service, customName: e.target.value })}
              placeholder="e.g. Custom Bi-LED Projector Retrofit"
              className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
              Custom Variation / Package
            </label>
            <input
              type="text"
              value={service.customVariation}
              onChange={(e) => onChange({ ...service, customVariation: e.target.value })}
              placeholder="e.g. 3.0 Inch Lens + Shroud Package"
              className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
