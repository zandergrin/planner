// Unicode-safe compression for URLs
// This implementation ensures compatibility with btoa() and URL encoding

export function compressForUrl(data: string): string {
  try {
    // First, let's try a simple compression approach
    // Remove unnecessary whitespace from JSON
    const minified = JSON.stringify(JSON.parse(data));
    
    // Use Unicode-safe compression
    const compressed = unicodeSafeCompress(minified);
    
    // Convert to URL-safe base64
    const base64 = btoa(compressed);
    const urlSafe = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return urlSafe;
  } catch (error) {
    console.error('Compression failed:', error);
    // Fallback to regular base64
    try {
      const minified = JSON.stringify(JSON.parse(data));
      const base64 = btoa(unescape(encodeURIComponent(minified)));
      return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } catch (fallbackError) {
      console.error('Fallback compression failed:', fallbackError);
      return btoa(data); // Last resort
    }
  }
}

export function decompressFromUrl(compressed: string): string {
  try {
    // Convert from URL-safe base64
    let base64 = compressed
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const compressedData = atob(base64);
    const decompressed = unicodeSafeDecompress(compressedData);
    
    return decompressed;
  } catch (error) {
    console.error('Decompression failed:', error);
    // Fallback: try to decode as regular base64
    try {
      let base64 = compressed
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      while (base64.length % 4) {
        base64 += '=';
      }
      
      const decoded = atob(base64);
      return decodeURIComponent(escape(decoded));
    } catch (fallbackError) {
      console.error('Fallback decompression failed:', fallbackError);
      throw new Error('Failed to decompress data');
    }
  }
}

// Unicode-safe compression algorithm
function unicodeSafeCompress(str: string): string {
  if (str.length === 0) return '';
  
  const dict: { [key: string]: number } = {};
  const data: number[] = [];
  let dictSize = 256;
  let w = '';
  
  // Initialize dictionary with single characters
  for (let i = 0; i < 256; i++) {
    dict[String.fromCharCode(i)] = i;
  }
  
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    const wc = w + c;
    
    if (dict.hasOwnProperty(wc)) {
      w = wc;
    } else {
      data.push(dict[w]);
      // Only add to dictionary if we haven't exceeded safe range
      if (dictSize < 65536) {
        dict[wc] = dictSize++;
      }
      w = c;
    }
  }
  
  if (w !== '') {
    data.push(dict[w]);
  }
  
  // Convert to Latin1-safe string
  return packNumbers(data);
}

function unicodeSafeDecompress(str: string): string {
  if (str.length === 0) return '';
  
  const data = unpackNumbers(str);
  const dict: { [key: number]: string } = {};
  let dictSize = 256;
  let w = '';
  const result: string[] = [];
  
  // Initialize dictionary with single characters
  for (let i = 0; i < 256; i++) {
    dict[i] = String.fromCharCode(i);
  }
  
  const first = data[0];
  if (first < 256) {
    w = String.fromCharCode(first);
  } else {
    throw new Error('Invalid compressed data');
  }
  result.push(w);
  
  for (let i = 1; i < data.length; i++) {
    const code = data[i];
    let entry: string;
    
    if (dict.hasOwnProperty(code)) {
      entry = dict[code];
    } else if (code === dictSize) {
      entry = w + w.charAt(0);
    } else {
      throw new Error('Invalid compressed data');
    }
    
    result.push(entry);
    
    // Only add to dictionary if we haven't exceeded safe range
    if (dictSize < 65536) {
      dict[dictSize++] = w + entry.charAt(0);
    }
    
    w = entry;
  }
  
  return result.join('');
}

// Pack numbers into a Latin1-safe string
function packNumbers(numbers: number[]): string {
  const result: string[] = [];
  
  for (const num of numbers) {
    if (num < 256) {
      // Single byte
      result.push(String.fromCharCode(num));
    } else {
      // Multi-byte encoding for larger numbers
      // Use a simple variable-length encoding
      if (num < 16384) {
        // 2 bytes: 10xxxxxx xxxxxxxx
        result.push(String.fromCharCode(128 + (num >> 8)));
        result.push(String.fromCharCode(num & 255));
      } else {
        // 3 bytes: 11xxxxxx xxxxxxxx xxxxxxxx
        result.push(String.fromCharCode(192 + (num >> 16)));
        result.push(String.fromCharCode((num >> 8) & 255));
        result.push(String.fromCharCode(num & 255));
      }
    }
  }
  
  return result.join('');
}

// Unpack numbers from a Latin1 string
function unpackNumbers(str: string): number[] {
  const result: number[] = [];
  let i = 0;
  
  while (i < str.length) {
    const byte1 = str.charCodeAt(i);
    
    if (byte1 < 128) {
      // Single byte
      result.push(byte1);
      i++;
    } else if (byte1 < 192) {
      // 2 bytes
      if (i + 1 >= str.length) break;
      const byte2 = str.charCodeAt(i + 1);
      result.push(((byte1 - 128) << 8) | byte2);
      i += 2;
    } else {
      // 3 bytes
      if (i + 2 >= str.length) break;
      const byte2 = str.charCodeAt(i + 1);
      const byte3 = str.charCodeAt(i + 2);
      result.push(((byte1 - 192) << 16) | (byte2 << 8) | byte3);
      i += 3;
    }
  }
  
  return result;
}

// Alternative simple compression using run-length encoding
export function simpleCompressForUrl(data: string): string {
  try {
    // Minify JSON first
    const minified = JSON.stringify(JSON.parse(data));
    
    // Simple run-length encoding for repeated characters
    const compressed = runLengthEncode(minified);
    
    // Use built-in encoding that's btoa-safe
    const encoded = btoa(unescape(encodeURIComponent(compressed)));
    
    return encoded
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (error) {
    console.error('Simple compression failed:', error);
    // Ultimate fallback
    return btoa(unescape(encodeURIComponent(data)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

export function simpleDecompressFromUrl(compressed: string): string {
  try {
    // Convert from URL-safe base64
    let base64 = compressed
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const decoded = atob(base64);
    const unescaped = decodeURIComponent(escape(decoded));
    
    return runLengthDecode(unescaped);
  } catch (error) {
    console.error('Simple decompression failed:', error);
    throw new Error('Failed to decompress data');
  }
}

// Run-length encoding for repeated patterns
function runLengthEncode(str: string): string {
  if (str.length === 0) return '';
  
  const result: string[] = [];
  let count = 1;
  let current = str[0];
  
  for (let i = 1; i < str.length; i++) {
    if (str[i] === current && count < 255) {
      count++;
    } else {
      if (count === 1) {
        result.push(current);
      } else if (count === 2) {
        result.push(current + current);
      } else {
        result.push(`~${count}${current}`);
      }
      current = str[i];
      count = 1;
    }
  }
  
  // Handle the last sequence
  if (count === 1) {
    result.push(current);
  } else if (count === 2) {
    result.push(current + current);
  } else {
    result.push(`~${count}${current}`);
  }
  
  return result.join('');
}

function runLengthDecode(str: string): string {
  const result: string[] = [];
  let i = 0;
  
  while (i < str.length) {
    if (str[i] === '~') {
      // Find the end of the count
      let countEnd = i + 1;
      while (countEnd < str.length && /\d/.test(str[countEnd])) {
        countEnd++;
      }
      
      if (countEnd < str.length) {
        const count = parseInt(str.substring(i + 1, countEnd), 10);
        const char = str[countEnd];
        result.push(char.repeat(count));
        i = countEnd + 1;
      } else {
        result.push(str[i]);
        i++;
      }
    } else {
      result.push(str[i]);
      i++;
    }
  }
  
  return result.join('');
}