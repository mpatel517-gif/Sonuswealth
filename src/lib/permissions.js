/**
 * Caelixa · src/lib/permissions.js
 *
 * X27 permission matrix (Phase 1.5 AU5).
 *
 * Defines who (role) can do what (action) to which document class. This is the
 * JS-side enforcement layer. Vault writes / reads / shares pass through these
 * checks before touching the storage backend. When the Postgres `vault`
 * tables exist (separate spec §4.3), an RLS policy translates the same matrix
 * into row-level security for defence-in-depth.
 *
 * Roles
 *   owner      — the account holder
 *   spouse     — co-account partner (household-shared visibility)
 *   ifa        — Independent Financial Adviser with explicit consent
 *   solicitor  — solicitor with explicit grant for an event (probate, divorce)
 *   accountant — chartered accountant with explicit grant
 *   viewer     — read-only family member / executor (post-mortem)
 *
 * Actions
 *   read       — view contents
 *   write      — upload / edit / replace
 *   share      — change permissions / invite another role
 *   download   — export raw file out of the vault
 *   delete     — remove permanently
 *
 * Document classes (canonical set — extend as vault evolves)
 *   identity, financial_statement, pension_statement, tax_return,
 *   will, lpa, trust_deed, court_order, medical, communication, other
 *
 * Resolution model: per (role × docClass) we list ACTIONS allowed. Anything
 * NOT in the list is denied. This is an allow-list, not deny-list — safer
 * default for a security boundary.
 */

// ── Action enum ─────────────────────────────────────────────────────────────
export const ACTIONS = Object.freeze({
  READ:     'read',
  WRITE:    'write',
  SHARE:    'share',
  DOWNLOAD: 'download',
  DELETE:   'delete',
});

// ── Role enum ───────────────────────────────────────────────────────────────
export const ROLES = Object.freeze({
  OWNER:      'owner',
  SPOUSE:     'spouse',
  IFA:        'ifa',
  SOLICITOR:  'solicitor',
  ACCOUNTANT: 'accountant',
  VIEWER:     'viewer',
});

// ── Document class enum ─────────────────────────────────────────────────────
export const DOC_CLASSES = Object.freeze({
  IDENTITY:            'identity',
  FINANCIAL_STATEMENT: 'financial_statement',
  PENSION_STATEMENT:   'pension_statement',
  TAX_RETURN:          'tax_return',
  WILL:                'will',
  LPA:                 'lpa',
  TRUST_DEED:          'trust_deed',
  COURT_ORDER:         'court_order',
  MEDICAL:             'medical',
  COMMUNICATION:       'communication',
  OTHER:               'other',
});

// ── Matrix definition ───────────────────────────────────────────────────────
// Tuple: [role][docClass] = Set of allowed actions
const ALL = new Set(Object.values(ACTIONS));
const READ_ONLY = new Set([ACTIONS.READ]);
const READ_DOWNLOAD = new Set([ACTIONS.READ, ACTIONS.DOWNLOAD]);
const READ_WRITE = new Set([ACTIONS.READ, ACTIONS.WRITE, ACTIONS.DOWNLOAD]);

const MATRIX = {
  // OWNER has full rights on every document class they own.
  [ROLES.OWNER]: {
    [DOC_CLASSES.IDENTITY]:            ALL,
    [DOC_CLASSES.FINANCIAL_STATEMENT]: ALL,
    [DOC_CLASSES.PENSION_STATEMENT]:   ALL,
    [DOC_CLASSES.TAX_RETURN]:          ALL,
    [DOC_CLASSES.WILL]:                ALL,
    [DOC_CLASSES.LPA]:                 ALL,
    [DOC_CLASSES.TRUST_DEED]:          ALL,
    [DOC_CLASSES.COURT_ORDER]:         ALL,
    [DOC_CLASSES.MEDICAL]:             ALL,
    [DOC_CLASSES.COMMUNICATION]:       ALL,
    [DOC_CLASSES.OTHER]:               ALL,
  },

  // SPOUSE (household partner) — shared visibility on financial picture but
  // not personal medical / individual will (UK wills are individual).
  [ROLES.SPOUSE]: {
    [DOC_CLASSES.IDENTITY]:            READ_ONLY,        // their own + shared docs only
    [DOC_CLASSES.FINANCIAL_STATEMENT]: READ_WRITE,
    [DOC_CLASSES.PENSION_STATEMENT]:   READ_DOWNLOAD,
    [DOC_CLASSES.TAX_RETURN]:          READ_DOWNLOAD,
    [DOC_CLASSES.WILL]:                READ_ONLY,
    [DOC_CLASSES.LPA]:                 READ_ONLY,
    [DOC_CLASSES.TRUST_DEED]:          READ_ONLY,
    [DOC_CLASSES.COURT_ORDER]:         READ_ONLY,
    [DOC_CLASSES.MEDICAL]:             new Set(),         // denied — personal
    [DOC_CLASSES.COMMUNICATION]:       READ_ONLY,
    [DOC_CLASSES.OTHER]:               READ_DOWNLOAD,
  },

  // IFA — needs broad financial read access for advice; cannot share or delete.
  [ROLES.IFA]: {
    [DOC_CLASSES.IDENTITY]:            READ_ONLY,
    [DOC_CLASSES.FINANCIAL_STATEMENT]: READ_DOWNLOAD,
    [DOC_CLASSES.PENSION_STATEMENT]:   READ_DOWNLOAD,
    [DOC_CLASSES.TAX_RETURN]:          READ_DOWNLOAD,
    [DOC_CLASSES.WILL]:                READ_ONLY,
    [DOC_CLASSES.LPA]:                 READ_ONLY,
    [DOC_CLASSES.TRUST_DEED]:          READ_DOWNLOAD,
    [DOC_CLASSES.COURT_ORDER]:         READ_ONLY,
    [DOC_CLASSES.MEDICAL]:             new Set(),
    [DOC_CLASSES.COMMUNICATION]:       READ_ONLY,
    [DOC_CLASSES.OTHER]:               READ_ONLY,
  },

  // SOLICITOR — typically granted for a specific event (probate, divorce). We
  // expose will / lpa / trust / court order. They CAN download for legal
  // proceedings but not share to third parties.
  [ROLES.SOLICITOR]: {
    [DOC_CLASSES.IDENTITY]:            READ_DOWNLOAD,
    [DOC_CLASSES.FINANCIAL_STATEMENT]: READ_DOWNLOAD,
    [DOC_CLASSES.PENSION_STATEMENT]:   READ_DOWNLOAD,
    [DOC_CLASSES.TAX_RETURN]:          READ_DOWNLOAD,
    [DOC_CLASSES.WILL]:                READ_DOWNLOAD,
    [DOC_CLASSES.LPA]:                 READ_DOWNLOAD,
    [DOC_CLASSES.TRUST_DEED]:          READ_DOWNLOAD,
    [DOC_CLASSES.COURT_ORDER]:         READ_DOWNLOAD,
    [DOC_CLASSES.MEDICAL]:             new Set(),
    [DOC_CLASSES.COMMUNICATION]:       READ_DOWNLOAD,
    [DOC_CLASSES.OTHER]:               READ_DOWNLOAD,
  },

  // ACCOUNTANT — narrower than IFA: tax-centric documents.
  [ROLES.ACCOUNTANT]: {
    [DOC_CLASSES.IDENTITY]:            READ_ONLY,
    [DOC_CLASSES.FINANCIAL_STATEMENT]: READ_DOWNLOAD,
    [DOC_CLASSES.PENSION_STATEMENT]:   READ_DOWNLOAD,
    [DOC_CLASSES.TAX_RETURN]:          READ_DOWNLOAD,
    [DOC_CLASSES.WILL]:                new Set(),
    [DOC_CLASSES.LPA]:                 new Set(),
    [DOC_CLASSES.TRUST_DEED]:          READ_ONLY,
    [DOC_CLASSES.COURT_ORDER]:         new Set(),
    [DOC_CLASSES.MEDICAL]:             new Set(),
    [DOC_CLASSES.COMMUNICATION]:       READ_ONLY,
    [DOC_CLASSES.OTHER]:               READ_ONLY,
  },

  // VIEWER (executor / family member with limited access, often post-mortem).
  [ROLES.VIEWER]: {
    [DOC_CLASSES.IDENTITY]:            READ_ONLY,
    [DOC_CLASSES.FINANCIAL_STATEMENT]: READ_ONLY,
    [DOC_CLASSES.PENSION_STATEMENT]:   READ_ONLY,
    [DOC_CLASSES.TAX_RETURN]:          READ_ONLY,
    [DOC_CLASSES.WILL]:                READ_ONLY,
    [DOC_CLASSES.LPA]:                 READ_ONLY,
    [DOC_CLASSES.TRUST_DEED]:          READ_ONLY,
    [DOC_CLASSES.COURT_ORDER]:         READ_ONLY,
    [DOC_CLASSES.MEDICAL]:             new Set(),
    [DOC_CLASSES.COMMUNICATION]:       READ_ONLY,
    [DOC_CLASSES.OTHER]:               READ_ONLY,
  },
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether a role is allowed to perform an action on a document class.
 * Unknown role or docClass → denied (allow-list default).
 *
 * @param {string} role
 * @param {string} action
 * @param {string} docClass
 * @returns {boolean}
 */
export function isAllowed(role, action, docClass) {
  const roleMatrix = MATRIX[role];
  if (!roleMatrix) return false;
  const allowed = roleMatrix[docClass];
  if (!allowed) return false;
  return allowed.has(action);
}

/**
 * Convenience: list every action a role can perform on a document class.
 *
 * @param {string} role
 * @param {string} docClass
 * @returns {string[]}
 */
export function allowedActions(role, docClass) {
  const roleMatrix = MATRIX[role];
  if (!roleMatrix) return [];
  const allowed = roleMatrix[docClass];
  if (!allowed) return [];
  return [...allowed];
}

/**
 * Convenience: list every document class a role can read.
 *
 * @param {string} role
 * @returns {string[]}
 */
export function readableClasses(role) {
  const roleMatrix = MATRIX[role];
  if (!roleMatrix) return [];
  return Object.entries(roleMatrix)
    .filter(([, set]) => set.has(ACTIONS.READ))
    .map(([cls]) => cls);
}

/**
 * Assertion form. Throws a recognisable error if denied. Use this at the
 * top of any Vault read/write handler.
 *
 * @param {string} role
 * @param {string} action
 * @param {string} docClass
 */
export function assertAllowed(role, action, docClass) {
  if (!isAllowed(role, action, docClass)) {
    const e = new Error(`X27 denied: role=${role} action=${action} docClass=${docClass}`);
    e.code = 'X27_DENIED';
    e.role = role;
    e.action = action;
    e.docClass = docClass;
    throw e;
  }
}

/**
 * Diagnostic export — flatten the matrix into a JSON-friendly array of
 * { role, docClass, actions[] } tuples. Useful for /admin pages and tests.
 */
export function matrixSnapshot() {
  const out = [];
  for (const [role, classes] of Object.entries(MATRIX)) {
    for (const [docClass, actionSet] of Object.entries(classes)) {
      out.push({ role, docClass, actions: [...actionSet] });
    }
  }
  return out;
}
