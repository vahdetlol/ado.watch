/**
 * XSS (Cross-Site Scripting) Protection Middleware
 * Sanitizes user input to prevent XSS attacks
 */

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // on* event handlers like onclick, onerror, etc.
  /<embed\b[^<]*>/gi,
  /<object\b[^<]*>/gi,
];

/**
 * Sanitize a string value
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  
  let sanitized = value;
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * XSS Protection Hook
 */
export function registerXSSProtection(app) {
  app.addHook('preValidation', async (request, reply) => {
    // Sanitize request body
    if (request.body) {
      request.body = sanitizeObject(request.body);
    }
    
    // Sanitize query parameters
    if (request.query) {
      request.query = sanitizeObject(request.query);
    }
    
    // Sanitize URL parameters
    if (request.params) {
      request.params = sanitizeObject(request.params);
    }
  });
  
  console.log(' XSS Protection middleware registered');
}
