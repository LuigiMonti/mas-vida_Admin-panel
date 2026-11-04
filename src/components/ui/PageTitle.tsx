import type { ReactNode } from 'react';

interface PageTitleProps {
  /** Parte del título en negro. */
  title: string;
  /** Parte en azul, como "Míralo en *un minuto*" en la web. Solo en el título de la página. */
  accent?: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageTitle({ title, accent, description, actions }: PageTitleProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] leading-[1.1] font-bold tracking-tight">
          {title}
          {accent && <span className="text-primary"> {accent}</span>}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
