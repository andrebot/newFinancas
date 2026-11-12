// DownloadUtility (OQ-149): hands the user a text file the browser already
// holds — plain text, or a CSV the API sent (OQ-243) — nothing is stored. No
// journey knowledge.

/**
 * Saves text as a file through the browser's download.
 *
 * @param fileName - The file's name, e.g. `backup-codes.txt`.
 * @param text - Its contents.
 * @param mediaType - Its type, e.g. `text/csv` (OQ-243); plain text by default.
 */
export default function downloadTextFile(
  fileName: string,
  text: string,
  mediaType = 'text/plain',
): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mediaType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
