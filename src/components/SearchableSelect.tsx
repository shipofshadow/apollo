import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface SearchableSelectProps {
  id?: string;
  value: string;
  options: string[];
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onChange: (value: string) => void;
}

export default function SearchableSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder = 'Search...',
  disabled = false,
  required = false,
  className = '',
  onChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return options;
    return options.filter(option => option.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const selectOption = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input id={id} tabIndex={-1} required={required} value={value} onChange={() => {}} className="sr-only" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={`${className} flex items-center justify-between gap-3 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? 'truncate text-white' : 'truncate text-gray-500'}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-gray-600"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1" role="listbox">
            {filtered.length > 0 ? (
              filtered.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => selectOption(option)}
                  className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-800 ${
                    option === value ? 'bg-gray-800 text-brand-orange' : 'text-gray-200'
                  }`}
                  role="option"
                  aria-selected={option === value}
                >
                  {option}
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-gray-500">No matches found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
