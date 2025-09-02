# 🧪 Metric Conversion Testing Commands

After the centralized conversion migration, use these commands to verify everything works correctly.

## 🔧 Browser Console Commands

### 1. Run Full Validation Suite
```javascript
// Import the validator (paste in console)
import('/client/src/utils/conversionValidator.js').then(validator => {
  validator.logValidationResults();
  validator.testDoubleConversionScenarios();
});
```

### 2. Test Specific Bounce Rate Scenarios
```javascript
// Test the original 4180% bug scenario
import('/client/src/utils/metricConversion.js').then(converter => {
  console.group('🐛 Testing Original Bug Scenarios');
  
  // Scenario 1: Client data (should NOT convert)
  const clientResult = converter.convertMetricValue({
    metricName: 'Bounce Rate',
    sourceType: 'Client', 
    rawValue: 41.8
  });
  console.log(`Client 41.8 → ${converter.formatMetricDisplay(clientResult)}`);
  console.log(`❌ BUG if > 100%: ${clientResult.value > 100 ? 'DETECTED' : 'FIXED'}`);
  
  // Scenario 2: Competitor data (should convert decimal)
  const compResult = converter.convertMetricValue({
    metricName: 'Bounce Rate',
    sourceType: 'Competitor',
    rawValue: 0.418
  });
  console.log(`Competitor 0.418 → ${converter.formatMetricDisplay(compResult)}`);
  console.log(`❌ BUG if > 100%: ${compResult.value > 100 ? 'DETECTED' : 'FIXED'}`);
  
  console.groupEnd();
});
```

### 3. Test Session Duration Conversions
```javascript
import('/client/src/utils/metricConversion.js').then(converter => {
  console.group('⏱️ Session Duration Tests');
  
  // Should convert seconds to minutes
  const secondsResult = converter.convertMetricValue({
    metricName: 'Session Duration',
    sourceType: 'Client',
    rawValue: 180
  });
  console.log(`180 seconds → ${converter.formatMetricDisplay(secondsResult)}`);
  console.log(`Expected: 3.0min | Got: ${secondsResult.value}min`);
  
  // Should NOT convert if already in minutes
  const minutesResult = converter.convertMetricValue({
    metricName: 'Session Duration',
    sourceType: 'Client',
    rawValue: 3
  });
  console.log(`3 (already minutes) → ${converter.formatMetricDisplay(minutesResult)}`);
  console.log(`Expected: 3.0min | Got: ${minutesResult.value}min`);
  
  console.groupEnd();
});
```

### 4. Enable Conversion Debug Logging
```javascript
// See all conversions in real-time
window.__DEBUG_CONVERSIONS = true;
console.log('🔍 Conversion debugging enabled - refresh page to see all conversions');
```

## 📊 Visual Verification Checklist

### ✅ Dashboard Header Values
- [ ] **Bounce Rate**: Should show ~41.8% (NOT 4180%)
- [ ] **Session Duration**: Should show ~3.2 min (NOT 192 seconds) 
- [ ] **Pages per Session**: Should show ~2.4 pages
- [ ] **Sessions per User**: Should show ~1.8 sessions

### ✅ Time Series Charts
- [ ] **Client line**: Bounce rate values 30-50% range
- [ ] **Competitor lines**: Reasonable percentage values
- [ ] **Industry Average**: Reasonable percentage values
- [ ] **CD Average**: Reasonable percentage values
- [ ] **No values over 100%** (except for very high bounce rates)

### ✅ Bar Charts
- [ ] All bars show reasonable values
- [ ] No bars extending off the chart (4180% bug)
- [ ] Tooltips show correct values with units

### ✅ Area Charts  
- [ ] Session duration in minutes (not seconds)
- [ ] Smooth curves without massive spikes
- [ ] Reasonable value ranges

## 🚨 Red Flags to Watch For

### 🔥 Critical Issues
- **Any bounce rate > 100%** (indicates double conversion)
- **Session duration > 60 minutes** (probably still in seconds)
- **Massive chart spikes** (conversion errors)
- **Values like 4180%** (classic double conversion)

### ⚠️ Warning Signs
- Inconsistent units across similar metrics
- Values that seem 100x too large or small
- Charts that look "broken" or have impossible values

## 🎯 Expected Results After Fix

### Bounce Rate Examples:
- ✅ Client: 41.8% (was showing as 4180%)
- ✅ Competitor: 38.5% (converted from 0.385)
- ✅ Industry Avg: 45.2% (reasonable range)
- ✅ CD Avg: 35.1% (reasonable range)

### Session Duration Examples:
- ✅ Client: 3.2 min (converted from 192 seconds)
- ✅ Industry Avg: 2.8 min (converted from 168 seconds)
- ✅ Competitor: 4.1 min (converted from 246 seconds)

## 🔧 Quick Fix Commands

If you find issues:

```javascript
// Check what conversions are happening
window.__DEBUG_CONVERSIONS = true;

// Inspect a specific value
import('/client/src/utils/metricConversion.js').then(converter => {
  const result = converter.convertMetricValue({
    metricName: 'YOUR_METRIC_NAME',
    sourceType: 'YOUR_SOURCE_TYPE', 
    rawValue: YOUR_RAW_VALUE
  });
  console.log('Conversion result:', result);
});
```

## 📈 Success Metrics

**✅ Migration Complete When:**
- All validation tests pass (console shows "🎉 All conversion tests passed!")
- No bounce rates over 100%
- Dashboard values look reasonable
- Charts display properly scaled data
- No console errors related to conversions

---

**🎯 Goal**: Zero instances of the 4180% bug and consistent metric display across all components!