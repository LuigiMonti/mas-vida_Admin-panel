import { cx } from '@/lib/cx';

interface TabsProps<K extends string> {
  tabs: Array<{ key: K; label: string; count?: number }>;
  active: K;
  onChange: (k: K) => void;
  label: string;
}

/** Pestañas de una página: gris, y azul con subrayado la activa (como el header). */
export function Tabs<K extends string>({ tabs, active, onChange, label }: TabsProps<K>) {
  return (
    <div role="tablist" aria-label={label} className="mb-5 flex gap-6 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={cx(
              'relative py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
              on
                ? 'text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-text-muted hover:text-primary',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-text-muted tabular-nums">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
