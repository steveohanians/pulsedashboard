# LoadKit v1 Testing Guide

## Current Status: Ready for Phase 1 Testing ✅

LoadKit v1 is implemented with zero-risk behavioral cloning. All existing functionality is preserved and LoadKit only activates when feature flags are enabled.

## Testing Phases

### Phase 1: Visual Parity Test (Start Here)

**Objective**: Verify LoadKit produces identical visual behavior to existing implementation

**Steps**:
1. Copy `.env.loadkit` to `.env.local`
2. Enable master switch only:
   ```
   REACT_APP_LOADKIT_ENABLED=true
   ```
3. Test both pages:
   - Dashboard loading states
   - Brand signals analysis flow

**Expected Result**: Identical behavior - no visual changes, same timing, same functionality

**Success Criteria**:
- [ ] Dashboard skeleton appears identical
- [ ] Brand signals progress steps work identically  
- [ ] No console errors
- [ ] No layout shifts
- [ ] All interactions work as before

### Phase 2: Component Isolation Test

**Enable single component**:
```
REACT_APP_LOADKIT_ENABLED=true
REACT_APP_LOADKIT_DASHBOARD=true
# REACT_APP_LOADKIT_BRAND_SIGNALS=false (stays existing)
```

**Success Criteria**:
- [ ] Dashboard uses LoadKit (should be identical)
- [ ] Brand signals uses existing implementation
- [ ] No cross-contamination between implementations

### Phase 3: Fun Copy Test

**Enable fun copy on dashboard**:
```
REACT_APP_LOADKIT_ENABLED=true
REACT_APP_LOADKIT_DASHBOARD=true
REACT_APP_LOADKIT_FUN_COPY=true
```

**Expected Behavior**:
- 0-3s: Serious copy ("Loading...")
- 3s+: Fun copy rotation (effectiveness only - dashboard doesn't have approved fun copy yet)
- Screen readers: Always serious copy

**Success Criteria**:
- [ ] Copy rotation works smoothly
- [ ] No layout shifts during message changes
- [ ] Fade transitions work properly
- [ ] Reduced motion respected

### Phase 4: Full System Test

**Enable everything**:
```
REACT_APP_LOADKIT_ENABLED=true
REACT_APP_LOADKIT_DASHBOARD=true
REACT_APP_LOADKIT_BRAND_SIGNALS=true
REACT_APP_LOADKIT_FUN_COPY=true
```

**Success Criteria**:
- [ ] Both pages use LoadKit
- [ ] Fun copy works where appropriate
- [ ] All existing functionality preserved
- [ ] Performance unchanged

## Testing Commands

### Start Development Server
```bash
cd client
npm run dev
```

### Check Feature Flags Status
Add to any component for debugging:
```typescript
import { useLoadKitDebug } from '@/hooks/useLoadKit'

// In component
const debug = useLoadKitDebug()
console.log('LoadKit Debug:', debug)
```

### Reset to Original (Emergency)
```
REACT_APP_LOADKIT_ENABLED=false
```
Instantly reverts to 100% original behavior.

## What to Watch For

### Success Indicators ✅
- Identical visual behavior when enabled
- Smooth copy transitions (when fun copy enabled)
- No console errors or warnings
- Same performance characteristics
- All user flows work identically

### Failure Indicators ❌
- Visual differences from original
- Console errors mentioning LoadKit
- Layout shifts during loading
- Changed timing or behavior
- Broken user interactions

### Emergency Actions
If any issues occur:
1. Set `REACT_APP_LOADKIT_ENABLED=false` immediately
2. Report specific issue and browser/device
3. LoadKit will instantly disable, returning to original

## Browser Testing Priority

1. **Chrome** (primary development browser)
2. **Safari** (potential timing differences)
3. **Firefox** (different animation handling)
4. **Mobile browsers** (performance considerations)

## Accessibility Testing

### Screen Reader Test
1. Enable screen reader (VoiceOver/NVDA)
2. Navigate through loading states
3. Verify announcements are clear and helpful
4. Confirm fun copy is NOT read by screen reader

### Reduced Motion Test
1. Enable "Reduce motion" in OS settings
2. Verify no animations occur
3. Confirm copy still rotates (text-only)

## Performance Monitoring

### Key Metrics
- First paint time unchanged
- JavaScript bundle size impact minimal
- Memory usage during loading states
- CPU usage during copy rotation

### Monitoring Tools
- Chrome DevTools Performance tab
- React DevTools Profiler
- Bundle analyzer for size impact

## Ready to Start Testing

The implementation is production-ready with comprehensive safety measures. Begin with Phase 1 by enabling the master flag and verifying visual parity.