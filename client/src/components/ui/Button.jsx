import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:ring-[rgb(var(--focus))]';

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
  icon: 'h-9 w-9',
};

const VARIANTS = {
  primary: 'bg-accent text-accent-fg shadow-card shadow-inset hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border border-line shadow-card hover:border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  subtle: 'bg-surface-2 text-ink hover:bg-surface-3',
  danger: 'bg-danger text-danger-fg shadow-card hover:opacity-90',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
  success: 'bg-success text-success-fg shadow-card hover:opacity-90',
};

/**
 * Polymorphic button. Use `as={Link}` for navigation so we never nest a
 * <button> inside an <a> (invalid HTML and confusing for screen readers).
 */
export const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    icon: Icon,
    iconRight: IconRight,
    className = '',
    children,
    disabled,
    type,
    ...props
  },
  ref
) {
  const isButton = Component === 'button';
  return (
    <Component
      ref={ref}
      className={`${BASE} ${SIZES[size] || SIZES.md} ${VARIANTS[variant] || VARIANTS.primary} ${className}`}
      {...(isButton ? { type: type || 'button', disabled: disabled || isLoading } : {})}
      aria-busy={isLoading || undefined}
      aria-disabled={!isButton && disabled ? true : undefined}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {children}
      {IconRight && !isLoading && <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </Component>
  );
});

export const IconButton = forwardRef(function IconButton({ label, icon: Icon, className = '', variant = 'ghost', ...props }, ref) {
  return (
    <Button ref={ref} variant={variant} size="icon" aria-label={label} title={label} className={className} {...props}>
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </Button>
  );
});
