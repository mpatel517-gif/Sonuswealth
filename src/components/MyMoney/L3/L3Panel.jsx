// ─────────────────────────────────────────────────────────────────────────────
// L3Panel — slot-architecture primitive for every domain L3 panel.
//
// Per design doc §2.2 (C-prime hybrid):
//   - FIXED TOP:    Hero (big number + sparkline + view-mode) + Tax treatment (IT/CGT/IHT)
//   - VARIABLE:     domain declares its middle sections (Pension AA, ISA allowance,
//                   Property S24, etc.)
//   - FIXED BOTTOM: Estate position (cross-tab IHT chip from T&E) + Data confidence
//
// Per design doc §3 (19 panels 1-to-1 per spec domain) every L3 module imports
// this primitive and configures it. Single primitive, max reuse.
//
// Props:
//   - entity         : the persona entity object (passed through to sections)
//   - ripple         : useRipple output (passed through to sections that need
//                      cross-tab data, especially EstatePositionSection)
//   - hero           : { metric, label, sublabel?, chartSeries? }
//   - taxTreatment   : { incomeTax: {headline, detail?},
//                        capitalGains: {headline, detail?},
//                        inheritance: {headline, detail?} }
//   - middle         : [ { key, render: ({entity, ripple}) => <jsx> } ]
//   - estate         : { position?, exposure?, daysToActivation?, action? }
//   - confidence     : { level: 'high'|'medium'|'low', totalFields?, verifiedFields?, lastValuation? }
//   - domainKey      : string identifier for the domain (data attribute for testing)
// ─────────────────────────────────────────────────────────────────────────────

import { HeroSection }           from './L3Sections/HeroSection.jsx'
import { TaxTreatmentSection }   from './L3Sections/TaxTreatmentSection.jsx'
import { EstatePositionSection } from './L3Sections/EstatePositionSection.jsx'
import { DataConfidenceSection } from './L3Sections/DataConfidenceSection.jsx'

export function L3Panel({
  entity, ripple,
  hero,
  taxTreatment,
  middle = [],
  estate,
  confidence,
  domainKey,
}) {
  return (
    <div
      className="sw-l3-panel"
      data-domain={domainKey}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
      }}
    >
      <HeroSection {...hero} entity={entity} ripple={ripple} />
      <TaxTreatmentSection {...taxTreatment} entity={entity} ripple={ripple} />

      {middle.map(section => (
        <div key={section.key} className="sw-l3-middle-section" data-section={section.key}>
          {section.render({ entity, ripple })}
        </div>
      ))}

      <div
        className="sw-l3-bottom-row"
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 8,
        }}
      >
        <EstatePositionSection {...estate} entity={entity} ripple={ripple} />
        <DataConfidenceSection {...confidence} entity={entity} ripple={ripple} />
      </div>
    </div>
  )
}
