// Burpee types: display names, colors and how-to text (see docs/proposal.txt 2.1).
// Order = easiest to hardest, used for stacking in charts later.

export const TYPES = {
  sixcount: {
    id: 'sixcount',
    name: '6-count',
    badge: '6-C',
    color: '#14968A',
    tint: '#DFF3F0',
    ink: '#0E6B62',
    summary: 'Military style: no jump. Builds conditioning.',
    steps: [
      'Squat down, hands on the floor',
      'Kick feet back into a plank',
      'Lower chest to the floor (push-up down)',
      'Push up (push-up up)',
      'Jump feet back to your hands',
      'Stand up (no jump)',
    ],
    pace: 'Beginner pace: 10–15 s.',
    easier: null,
    mistakes: 'Half push-ups, not standing fully upright.',
    defaultPace: 12,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    badge: 'STD',
    color: '#F28C00',
    tint: '#FFF1DE',
    ink: '#9A4A06',
    summary: 'Squat, plank, push-up, jump. The classic.',
    steps: [
      'Stand, feet shoulder-width apart',
      'Squat down, hands on the floor',
      'Kick feet back into a plank',
      'Do one push-up (chest to floor)',
      'Jump feet back to your hands',
      'Jump up, hands overhead',
    ],
    pace: 'Beginner pace: 12–15 s. Fit: 4–5 s.',
    easier: 'Step back and in instead of kicking, skip the jump.',
    mistakes: 'Sagging hips in the plank, landing stiff-legged.',
    defaultPace: 15,
  },
  seal: {
    id: 'seal',
    name: 'Navy SEAL',
    badge: 'SEAL',
    color: '#1E3F8A',
    tint: '#E4EAF6',
    ink: '#1E3F8A',
    summary: '3 push-ups + 2 knee drives. Builds strength.',
    steps: [
      'Squat down, hands on the floor',
      'Kick feet back into a plank',
      'Push-up',
      'Left knee to left elbow, return',
      'Push-up',
      'Right knee to right elbow, return',
      'Push-up',
      'Feet back to hands, stand up',
    ],
    pace: 'Beginner pace: 25–30 s. Try it when you can do ~10 clean push-ups in a row.',
    easier: 'Do the push-ups on your knees.',
    mistakes: 'Hips sagging or piking during push-ups, rushing the knee drives.',
    defaultPace: 30,
  },
  other: {
    id: 'other',
    name: 'Other',
    badge: 'OTH',
    color: '#B9B9C2',
    tint: '#F0F0F2',
    ink: '#5F6168',
    summary: 'Your own variation, e.g. "No push-up".',
    steps: [],
    pace: '',
    easier: null,
    mistakes: null,
    defaultPace: 15,
  },
};

export const TYPE_ORDER = ['standard', 'sixcount', 'seal', 'other'];

export function typeName(workout) {
  if (workout.type === 'other') return (workout.typeName || '').trim() || 'Other';
  return TYPES[workout.type].name;
}

// "{count} {type display name} burpees", e.g. "40 Standard burpees".
export function workoutTitle(workout, count = workout.count) {
  return `${count} ${typeName(workout)} burpees`;
}
