
const isDateString = (val: string): boolean => {
  if (val.length < 5) return false;
  const d = new Date(val);
  return !isNaN(d.getTime()) && (
    /^\d{4}-\d{2}-\d{2}/.test(val) || 
    /^\d{4}\/\d{2}\/\d{2}/.test(val) ||
    val.includes('T') && (val.endsWith('Z') || val.includes('+') || val.includes('-'))
  );
};

export const nullifyTransform = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => nullifyTransform(item));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = nullifyTransform(obj[key]);
    }
    return newObj;
  }
  return null;
};

export const smartTransform = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => smartTransform(item));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = smartTransform(obj[key]);
    }
    return newObj;
  }

  const type = typeof obj;
  if (type === 'string') {
    if (isDateString(obj)) {
      try {
        // Convert the existing date value to full ISO 8601 (TimestampZ)
        return new Date(obj).toISOString();
      } catch {
        // Fallback to current time if conversion fails
        return new Date().toISOString();
      }
    }
    return "";
  }
  if (type === 'number') {
    // Randomly return 0 or a negative number between -1 and -100
    return Math.random() > 0.5 ? 0 : -(Math.floor(Math.random() * 100) + 1);
  }
  if (type === 'boolean') {
    return false;
  }
  return null;
};
