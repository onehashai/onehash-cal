import { useCallback } from "react";

// Type definitions for Customer.io analytics
interface CustomerIOAnalytics {
  track: (event: string, payload?: Record<string, any>) => void;
}

declare global {
  interface Window {
    cioanalytics?: CustomerIOAnalytics;
  }
}

interface UseCustomerIOReturn {
  trackEvent: (trackingEvent: string, eventPayload?: Record<string, any>) => void;
}

/**
 * Custom hook for Customer.io event tracking in Next.js
 * Safely handles window object and provides event tracking functionality
 *
 * @returns Object with trackEvent function and isAvailable boolean
 */
export const useCustomerIO = (): UseCustomerIOReturn => {
  const trackEvent = useCallback((trackingEvent: string, eventPayload?: Record<string, any>) => {
    // Check if we're in the browser and if Customer.io analytics is available
    if (typeof window !== "undefined" && window.cioanalytics) {
      try {
        window.cioanalytics.track(trackingEvent, eventPayload);
        console.log("Customer.io event tracked:", trackingEvent, eventPayload);
      } catch (error) {
        console.error("Error tracking Customer.io event:", error);
      }
    } else {
      console.warn("Customer.io analytics not available");
    }
  }, []);

  return {
    trackEvent,
  };
};
