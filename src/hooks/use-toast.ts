
// Re-export toast from sonner with adaptations for compatibility
import { toast as sonnerToast, type ToastT } from "sonner";

// Define types to match the previous toast API
type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
  action?: React.ReactNode;
};

// Create a wrapper function to adapt between APIs
const adaptedToast = (props: ToastProps) => {
  const { title, description, variant, duration, action } = props;
  
  // Combine title and description for Sonner
  const message = title ? title : undefined;
  const options: any = {
    description: description,
    duration: duration,
    action: action,
  };
  
  // Map variants to Sonner's types
  if (variant === "destructive") {
    return sonnerToast.error(message, options);
  } else if (variant === "success") {
    return sonnerToast.success(message, options);
  } else {
    return sonnerToast(message, options);
  }
};

// Export a compatible interface
export function useToast() {
  return {
    toast: (props: ToastProps) => adaptedToast(props),
    // These are not implemented in sonner but provided for compatibility
    dismiss: () => {},
    toasts: []
  };
}

// Also export the adapted toast function directly
export const toast = (props: ToastProps) => adaptedToast(props);

// For direct access to sonner's original API
export const sonner = sonnerToast;



