// Barrel export for MyMoney L3 primitives.
// Domain modules import everything they need from this single path:
//   import { L3Panel } from 'src/components/MyMoney/L3'
//
// As Wave 0 ships more primitives (DrillableNumber, DrillableChart,
// L4NumberPanel, L4ChartPanel), they're added here.

export { L3Panel } from './L3Panel.jsx'
export { HeroSection } from './L3Sections/HeroSection.jsx'
export { TaxTreatmentSection } from './L3Sections/TaxTreatmentSection.jsx'
export { EstatePositionSection } from './L3Sections/EstatePositionSection.jsx'
export { DataConfidenceSection } from './L3Sections/DataConfidenceSection.jsx'
export { DrillableNumber } from './DrillableNumber.jsx'
export { L4NumberPanel }   from './L4NumberPanel.jsx'
