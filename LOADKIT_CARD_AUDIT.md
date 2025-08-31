# LoadKit Card-Level Loading Audit & Implementation Plan

## Current State Analysis

### ✅ Page-Level LoadKit (Already Implemented)
- **Dashboard**: Full page skeleton using LoadKit.Dashboard 
- **Brand Signals**: Analysis flow using LoadKit.BrandSignals

### 🔍 Card-Level Loading Inconsistencies Found

#### 1. **AI Insights Components** (High Priority - Safe to Change)
**File**: `/components/ai-insights.tsx`
- Uses: `isLoadingContext` state but no visible spinner
- **Issue**: Missing loading indicator
- **Risk**: Low - can only improve UX

#### 2. **Metric Insight Box** (High Priority - Clear Inconsistencies) 
**File**: `/components/metric-insight-box.tsx`  
- **Current**: `<Loader2 className="h-4 w-4 mr-2 animate-spin" />` (2 instances)
- **Issues**: 
  - Inconsistent sizing (h-4 w-4 vs should be standardized)
  - Direct Loader2 usage instead of LoadKit pattern
- **Risk**: Low - just standardizing existing spinners

#### 3. **Insight Generation Button** (Medium Priority)
**File**: `/components/insight-generation-button.tsx`
- **Current**: `<Loader2 className="h-4 w-4 animate-spin" />` 
- **Issue**: Button loading not using LoadKit button pattern
- **Risk**: Low - isolated button component

#### 4. **Legacy UI LoadingSpinner** (Medium Priority) 
**File**: `/components/ui/LoadingSpinner.tsx`
- **Current**: Old loading spinner component still exists
- **Issue**: Duplicate of new LoadKit spinner
- **Risk**: Medium - need to ensure nothing depends on it

#### 5. **Evidence Drawer** (Low Priority - Don't Touch)
**File**: `/components/evidence-drawer.tsx`  
- **Current**: `<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4">`
- **Issue**: Custom spinner instead of Loader2
- **Risk**: Low priority - complex component, leave for later

---

## Safe Implementation Strategy

### Phase 2A: High-Impact, Low-Risk Cards (Week 1)

**Target Components (Skip Effectiveness for Now)**:
1. `metric-insight-box.tsx` - Standardize existing Loader2 usage
2. `insight-generation-button.tsx` - Convert to LoadKit button pattern  
3. `ai-insights.tsx` - Add proper loading indicator

**Approach**:
```typescript
// Instead of direct Loader2 usage:
<Loader2 className="h-4 w-4 mr-2 animate-spin" />

// Use LoadKit ButtonLoadingSpinner:
import { ButtonLoadingSpinner } from '@/components/loading'
<ButtonLoadingSpinner size="sm" />
```

### Phase 2B: Systematic Card Integration (Week 2)

**Create LoadKit Card Wrapper**:
```typescript
// New component: LoadKit.Card  
interface LoadKitCardProps {
  isLoading: boolean
  children: React.ReactNode
  surface?: 'metric-insights' | 'ai-insights' | 'general'
  loadingText?: string
  showSpinner?: boolean
}

// Usage:
<LoadKit.Card isLoading={isLoadingInsights} surface="metric-insights">
  {cardContent}
</LoadKit.Card>
```

### Phase 2C: Legacy Cleanup (Week 3)

1. **Audit Legacy Dependencies**: Check what uses `/ui/LoadingSpinner.tsx`
2. **Migration Path**: Replace with LoadKit equivalents
3. **Remove Duplicates**: Clean up old spinner implementations

---

## Implementation Steps (This Week)

### Step 1: Create LoadKit Card Components

**Add to `/components/loading/LoadKit.tsx`**:
```typescript
// Card-specific loading wrapper
interface LoadKitCardProps {
  isLoading: boolean
  children: React.ReactNode  
  className?: string
  surface?: LoadingSurface
  loadingText?: string
}

function LoadKitCard({ isLoading, children, className, surface = 'general', loadingText }: LoadKitCardProps) {
  const enabled = useFeatureFlag('LOADKIT_CARDS')
  
  if (!enabled || !isLoading) {
    return <>{children}</>
  }
  
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <LoadingSpinner 
        size="md"
        text={loadingText}
        showText={!!loadingText}
        centered={true}
      />
    </div>
  )
}
```

### Step 2: Add New Feature Flag

**Add to `.env.local`**:
```bash
REACT_APP_LOADKIT_CARDS=false  # Disabled by default
```

### Step 3: Safe Card Integration (One at a Time)

**Priority Order**:
1. **metric-insight-box.tsx** (2 spinners → standardized)
2. **insight-generation-button.tsx** (1 button → ButtonLoadingSpinner)  
3. **ai-insights.tsx** (add missing loading state)

### Step 4: Testing Protocol

**Per Component**:
1. Enable `REACT_APP_LOADKIT_CARDS=true`
2. Test specific component loading states
3. Verify identical visual behavior
4. Check for any breaking changes
5. Test rollback by disabling flag

---

## Risk Mitigation

### Low-Risk First (This Week)
- ✅ **metric-insight-box.tsx** - Just standardizing existing spinners
- ✅ **insight-generation-button.tsx** - Isolated button component  
- ✅ **ai-insights.tsx** - Adding missing loading state

### Medium-Risk Later
- ⚠️ **ui/LoadingSpinner.tsx** - Check dependencies first
- ⚠️ **Complex card interactions** - Leave for Phase 3

### High-Risk Avoid
- ❌ **effectiveness-card.tsx** - Skip (already has fun copy)
- ❌ **evidence-drawer.tsx** - Complex, leave for later
- ❌ **Core page components** - Already done

---

## Success Metrics

### Visual Consistency
- All card spinners use same size scale (xs/sm/md/lg)
- All card spinners use Loader2 icon
- Consistent colors (text-primary)

### Behavioral Preservation  
- Same loading timing
- Same disabled states  
- Same error handling

### Feature Flag Control
- Granular rollback capability
- Safe testing per component
- Zero breaking changes

---

## Next Steps

1. **Create LoadKit.Card component** (30 mins)
2. **Add REACT_APP_LOADKIT_CARDS flag** (5 mins)
3. **Integrate metric-insight-box.tsx** (20 mins) 
4. **Test and validate** (15 mins)
5. **Proceed to next component**

**Total Estimated Time**: 2-3 hours for Phase 2A

This approach ensures we can systematically improve card loading consistency while maintaining zero risk through granular feature flag control.