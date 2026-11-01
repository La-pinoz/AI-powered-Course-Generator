// Keep identical to client/src/constants/course.js.
export const TOPIC_MIN = 2;
export const TOPIC_MAX = 200;

// Allowed module counts per depth.
export const DEPTHS = Object.freeze({
  quick: { min: 3, max: 3 },
  standard: { min: 4, max: 5 },
  'in-depth': { min: 6, max: 6 },
});

export const LESSONS_PER_MODULE = Object.freeze({ min: 3, max: 5 });

export const TITLE_MAX = 200;
