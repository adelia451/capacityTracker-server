const reasonMap = {
  // internal
  'accomplishment': 'internal',
  'loneliness': 'internal',
  'low motivation': 'internal',
  'mentally tired': 'internal',
  'overthinking': 'internal',
  'overwhelmed': 'internal',
  'self image': 'internal',

  // physical
  'hunger': 'physical',
  'low energy': 'physical',
  'sickness': 'physical',

  // external
  'career': 'external',
  'conflict': 'external',
  'family': 'external',
  'hobby': 'external',
  'relationship': 'external',
  'relaxation': 'external',
  'school': 'external',
  'social activity': 'external',
  'social life': 'external',
  'workload': 'external',

  // fallback
  'no clear reason': 'neutral'
}

module.exports = reasonMap