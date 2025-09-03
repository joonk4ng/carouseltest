// Utility for handling URL parameters to autofill crew information - moved to separate project
// This allows admins to create pre-filled links for specific crews

// initialize object for crew member
export interface CrewMember {
  name: string;
  classification: string;
}

// initialize object for crew parameters
export interface CrewParams {
  crewName?: string;
  crewNumber?: string;
  fireName?: string;
  fireNumber?: string;
  date?: string; // Format: YYYY-MM-DD (single date) or YYYY-MM-DD to YYYY-MM-DD (date range)
  crewData?: string; // JSON string of crew members
}

/**
 * Parse URL parameters to extract crew information
 * Example URLs: 
 * - Single date: https://joonk4ng.github.io?crewName=Alpha%20Crew&crewNumber=A1&fireName=Smith%20Fire&fireNumber=2024-001&date=2024-01-15
 * - Date range: https://joonk4ng.github.io?crewName=Alpha%20Crew&crewNumber=A1&fireName=Smith%20Fire&fireNumber=2024-001&date=2024-01-15%20to%202024-01-16
 */
export function parseCrewParams(): CrewParams {
  const urlParams = new URLSearchParams(window.location.search);
  
  return {
    crewName: urlParams.get('crewName') || undefined,
    crewNumber: urlParams.get('crewNumber') || undefined,
    fireName: urlParams.get('fireName') || undefined,
    fireNumber: urlParams.get('fireNumber') || undefined,
    date: urlParams.get('date') || undefined,
    crewData: urlParams.get('crewData') || undefined,
  };
}

/**
 * Parse crew data from URL parameter
 */
export function parseCrewData(crewDataString?: string): CrewMember[] {
  if (!crewDataString) return [];
  
  try {
    return JSON.parse(decodeURIComponent(crewDataString));
  } catch (error) {
    console.error('Error parsing crew data:', error);
    return [];
  }
}

/**
 * Create a URL with crew parameters for sharing
 */
export function createCrewUrl(params: CrewParams): string {
  const baseUrl = window.location.origin + window.location.pathname;
  const urlParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      urlParams.set(key, value);
    }
  });
  
  const queryString = urlParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Clear URL parameters after processing them
 */
export function clearUrlParams(): void {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}

/**
 * Check if URL has crew parameters
 */
export function hasCrewParams(): boolean {
  const params = parseCrewParams();
  return Object.values(params).some(value => value !== undefined);
}

/**
 * Validate crew parameters
 */
export function validateCrewParams(params: CrewParams): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate date format if provided
  if (params.date) {
    const singleDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const dateRangeRegex = /^\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/;
    
    if (!singleDateRegex.test(params.date) && !dateRangeRegex.test(params.date)) {
      errors.push('Date format should be YYYY-MM-DD (single date) or YYYY-MM-DD to YYYY-MM-DD (date range)');
    } else {
      // Additional validation for date range
      if (dateRangeRegex.test(params.date)) {
        const [startDate, endDate] = params.date.split(' to ');
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
          errors.push('Start date cannot be after end date');
        }
      }
      
      // Validate that the date(s) are valid dates
      const datesToCheck = dateRangeRegex.test(params.date) 
        ? params.date.split(' to ') 
        : [params.date];
      
      for (const dateStr of datesToCheck) {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          errors.push(`Invalid date: ${dateStr}`);
        }
      }
    }
  }
  
  // Validate crew number format if provided
  if (params.crewNumber && !/^[A-Z0-9-]+$/.test(params.crewNumber)) {
    errors.push('Crew number should contain only letters, numbers, and hyphens');
  }
  
  // Validate fire number format if provided
  if (params.fireNumber && !/^[A-Z0-9\s-]+$/.test(params.fireNumber)) {
    errors.push('Fire number should contain only letters, numbers, spaces, and hyphens');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate admin links for different crews
 * This function can be used by admins to create pre-filled links
 */
export function generateAdminLinks(): Record<string, string> {
  const baseUrl = 'https://joonk4ng.github.io';
  
  return {
    'Alpha Crew - Smith Fire (Single Date)': `${baseUrl}?crewName=Alpha%20Crew&crewNumber=A1&fireName=Smith%20Fire&fireNumber=2024-001&date=2024-01-15`,
    'Bravo Crew - Johnson Fire (Date Range)': `${baseUrl}?crewName=Bravo%20Crew&crewNumber=B2&fireName=Johnson%20Fire&fireNumber=2024-002&date=2024-01-15%20to%202024-01-16`,
    'Charlie Crew - Williams Fire (No Date)': `${baseUrl}?crewName=Charlie%20Crew&crewNumber=C3&fireName=Williams%20Fire&fireNumber=2024-003`,
  };
}

/**
 * Decode URL-safe strings
 */
export function decodeUrlParam(param: string): string {
  return decodeURIComponent(param.replace(/\+/g, ' '));
}

/**
 * Encode strings for URL safety
 */
export function encodeUrlParam(param: string): string {
  return encodeURIComponent(param);
}

/**
 * Convert a single date to a date range (same start and end date)
 * This is useful when the app expects a date range but user provides a single date
 */
export function convertSingleDateToRange(date: string): string {
  return `${date} to ${date}`;
}

/**
 * Check if a date string is a single date or a date range
 */
export function isDateRange(dateString: string): boolean {
  return dateString.includes(' to ');
} 