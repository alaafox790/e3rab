const text = `[
  { "word": "ذهب", "category": "فعل", "analysis": "فعل ماض" },
  { "word": "الول`;

const matches = text.match(/\{[^{}]+\}/g);
console.log(matches);
