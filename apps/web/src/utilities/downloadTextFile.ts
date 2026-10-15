// DownloadUtility (OQ-149): hands the user a plain-text file made in the
// browser — nothing is fetched or stored. No journey knowledge.

/**
 * Saves text as a file through the browser's download.
 *
 * @param fileName - The file's name, e.g. `backup-codes.txt`.
 * @param text - Its contents.
 */
export default function downloadTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
