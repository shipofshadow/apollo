declare module 'react-select' {
  import * as React from 'react';

  export interface Option {
    value: string;
    label: string;
  }

  export type SingleValue<T> = T | null;

  export interface Props<T = Option> extends React.ComponentPropsWithoutRef<'div'> {
    options?: T[];
    value?: T | null;
    onChange?: (value: any) => void;
    styles?: any;
    isClearable?: boolean;
    placeholder?: string;
    inputId?: string;
    name?: string;
    isDisabled?: boolean;
    classNamePrefix?: string;
    menuPortalTarget?: HTMLElement | null;
    menuPosition?: 'absolute' | 'fixed';
  }

  const Select: React.ComponentType<Props>;
  export default Select;
}
