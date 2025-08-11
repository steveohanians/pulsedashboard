// Custom ESLint rules to enforce query key best practices
module.exports = {
  plugins: ['@typescript-eslint'],
  rules: {
    // Prevent string-based query keys
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Property[key.name="queryKey"] ObjectExpression Property[key.value="/api/"][raw*="/api/"]',
        message: 'Use tuple-based query keys from QueryKeys or AdminQueryKeys helpers instead of string-based patterns. Replace `queryKey: ["/api/..."]` with `queryKey: QueryKeys.methodName()` or `queryKey: AdminQueryKeys.methodName()`.'
      },
      {
        selector: 'CallExpression[callee.property.name="invalidateQueries"] ObjectExpression Property[key.name="queryKey"] ArrayExpression Literal[value*="/api/"]',
        message: 'Use tuple-based query keys from QueryKeys or AdminQueryKeys helpers in invalidateQueries. Replace `queryKey: ["/api/..."]` with `queryKey: QueryKeys.methodName()` or `queryKey: AdminQueryKeys.methodName()`.'
      }
    ]
  }
};