/**
 * Central UI Style Standards - Replit Style (Style 2)
 * 
 * Use these constants to ensure consistent, readable text throughout the app.
 * Never use faint text colors - always use these Replit-style standards.
 */

// Text Colors - Replit Style (always readable, never faint)
export const TEXT_COLORS = {
  // Primary text - use for most content
  primary: "text-slate-900",
  // Secondary text - use for labels, descriptions
  secondary: "text-slate-700",
  // Tertiary text - use sparingly for subtle hints
  tertiary: "text-slate-600",
  // Placeholder text
  placeholder: "text-slate-400",
  // Disabled text - still readable
  disabled: "text-slate-500",
  // Error/danger text
  danger: "text-red-600",
  // Success text
  success: "text-green-600",
  // Warning text
  warning: "text-amber-600",
  // Info text
  info: "text-blue-600",
} as const;

// Background Colors - Replit Style
export const BG_COLORS = {
  white: "bg-white",
  slate50: "bg-slate-50",
  slate100: "bg-slate-100",
  slate900: "bg-slate-900",
} as const;

// Button Styles - Replit Style
export const BUTTON_STYLES = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm",
  secondary: "bg-slate-100 hover:bg-slate-200 text-slate-900",
  ghost: "bg-transparent hover:bg-slate-100 text-slate-700",
  danger: "bg-red-600 hover:bg-red-700 text-white",
} as const;

// Input Styles - Replit Style
export const INPUT_STYLES = {
  default: "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400",
  focus: "focus:ring-1 focus:ring-blue-500 focus:border-blue-500",
} as const;

// Helper function to combine text color classes
export const textClass = (variant: keyof typeof TEXT_COLORS = "primary") => {
  return TEXT_COLORS[variant];
};

// Helper function to combine button classes
export const buttonClass = (variant: keyof typeof BUTTON_STYLES = "primary") => {
  return BUTTON_STYLES[variant];
};

// Helper function to combine input classes
export const inputClass = () => {
  return `${INPUT_STYLES.default} ${INPUT_STYLES.focus}`;
};
