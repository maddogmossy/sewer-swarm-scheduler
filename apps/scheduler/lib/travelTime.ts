/**
 * Travel time calculation utilities
 * 
 * For now, uses a simple mock calculation based on postcode distance.
 * In production, this would integrate with a mapping API like Google Maps, Mapbox, or similar.
 */

/**
 * Extract postcode from a UK address string
 * UK postcodes are typically in formats like: "SW1A 2AA", "M1 1AA", "B33 8TH"
 */
export function extractPostcode(address: string): string | null {
  if (!address) return null;
  
  // UK postcode pattern: 1-2 letters, 1-2 digits, optional space, 1 digit, 2 letters
  const postcodeRegex = /([A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2})/i;
  const match = address.match(postcodeRegex);
  return match ? match[1].toUpperCase().replace(/\s/g, '') : null;
}

/**
 * Calculate approximate travel time in minutes between two UK postcodes
 * This is a mock implementation - in production, use a real mapping API
 * 
 * @param fromPostcode Starting postcode
 * @param toPostcode Destination postcode
 * @returns Travel time in minutes (mock: 30-90 minutes based on postcode difference)
 */
export function calculateTravelTime(fromPostcode: string | null, toPostcode: string | null): number {
  if (!fromPostcode || !toPostcode) {
    // Default travel time if postcodes are missing
    return 45; // 45 minutes default
  }

  // Mock calculation: simple hash-based distance
  // In production, replace with actual distance API call
  const hash1 = fromPostcode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hash2 = toPostcode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const diff = Math.abs(hash1 - hash2);
  
  // Return travel time between 20-90 minutes based on "distance"
  const minutes = 20 + (diff % 70);
  return minutes;
}

/**
 * Calculate start time based on:
 * - Default shift start time (day/night)
 * - Employee start location (home postcode if startsFromHome, else depot address)
 * - Job site address
 * - Pre-start buffer (for vehicle checks, traffic, etc.)
 * 
 * @param defaultStartTime Default start time for the shift (e.g., "08:30")
 * @param employeeStartLocation Employee's home postcode or depot address
 * @param jobAddress Job site address
 * @param preStartBufferMinutes Minutes to add before default start (for vehicle checks, traffic)
 * @returns Calculated start time in HH:MM format
 */
export function calculateStartTime(
  defaultStartTime: string,
  employeeStartLocation: string | null,
  jobAddress: string | null,
  preStartBufferMinutes: number = 15
): string {
  if (!employeeStartLocation || !jobAddress) {
    // If we don't have both locations, just return default
    return defaultStartTime;
  }

  // Extract postcodes
  const fromPostcode = extractPostcode(employeeStartLocation);
  const toPostcode = extractPostcode(jobAddress);

  if (!fromPostcode || !toPostcode) {
    // If we can't extract postcodes, return default
    return defaultStartTime;
  }

  // Calculate travel time
  const travelMinutes = calculateTravelTime(fromPostcode, toPostcode);
  
  // Total time needed: travel time + pre-start buffer
  const totalMinutes = travelMinutes + preStartBufferMinutes;

  // Parse default start time
  const [hours, minutes] = defaultStartTime.split(':').map(Number);
  const defaultDate = new Date(2000, 0, 1, hours || 8, minutes || 0);

  // Subtract total minutes from default start time
  defaultDate.setMinutes(defaultDate.getMinutes() - totalMinutes);

  // Format as HH:MM
  return `${defaultDate.getHours().toString().padStart(2, '0')}:${defaultDate.getMinutes().toString().padStart(2, '0')}`;
}
