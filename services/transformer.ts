
const isDateString = (val: string): boolean => {
  if (val.length < 5) return false;
  const d = new Date(val);
  return !isNaN(d.getTime()) && (
    /^\d{4}-\d{2}-\d{2}/.test(val) ||
    /^\d{4}\/\d{2}\/\d{2}/.test(val) ||
    val.includes('T') && (val.endsWith('Z') || val.includes('+') || val.includes('-'))
  );
};

// 清理JSON字符串中的特殊字符（如Slack等平台添加的特殊字符）
export const cleanJsonString = (jsonStr: string): string => {
  return jsonStr
    // 替换智能引号为标准引号
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // 替换全角冒号和逗号
    .replace(/：/g, ':')
    .replace(/，/g, ',')
    // 移除零宽字符
    .replace(/\u200B/g, '') // 零宽空格
    .replace(/\u200C/g, '') // 零宽非连接符
    .replace(/\u200D/g, '') // 零宽连接符
    .replace(/\uFEFF/g, '') // 零宽非断空格 (BOM)
    // 替换其他特殊空格为标准空格
    .replace(/\u00A0/g, ' ') // 非断空格
    .replace(/\u2003/g, ' ') // Em空格
    .replace(/\u2002/g, ' ') // En空格
    // 移除可能的控制字符
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
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
