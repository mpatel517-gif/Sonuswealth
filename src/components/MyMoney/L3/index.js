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
export { DrillableChart } from './DrillableChart.jsx'
export { L4ChartPanel }   from './L4ChartPanel.jsx'

// L3-2 domain panels — first real consumers of L3Panel.
// Tier A:
export { IncomeSourcesPanel } from './L3Sections/IncomeSourcesPanel.jsx'
export { WrappersPanel }      from './L3Sections/WrappersPanel.jsx'
export { StatePensionPanel }  from './L3Sections/StatePensionPanel.jsx'
// Tier B:
export { TaxObligationsPanel } from './L3Sections/TaxObligationsPanel.jsx'
export { IHTEstatePanel }      from './L3Sections/IHTEstatePanel.jsx'
export { TrustsPanel }         from './L3Sections/TrustsPanel.jsx'
