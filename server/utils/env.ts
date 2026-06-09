import fs from 'fs';
import path from 'path';

export async function updateEnvFile(updates: Record<string, string>): Promise<void> {
  try {
    const envPath = path.join(process.cwd(), '.env');
    let content = '';

    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf-8');
    }

    const lines = content.split(/\r?\n/);
    const updatedLines: string[] = [...lines];

    for (const [key, value] of Object.entries(updates)) {
      let keyFound = false;
      for (let i = 0; i < updatedLines.length; i++) {
        if (updatedLines[i].trim().startsWith(`${key}=`)) {
          updatedLines[i] = `${key}=${value}`;
          keyFound = true;
          break;
        }
      }
      if (!keyFound) {
        // Ensure we don't append to an empty line if the file is empty
        if (updatedLines.length === 1 && updatedLines[0] === '') {
          updatedLines[0] = `${key}=${value}`;
        } else {
          updatedLines.push(`${key}=${value}`);
        }
      }
      // Dynamically update the current process env
      process.env[key] = value;
    }

    fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf-8');
    console.log(`Successfully updated .env file with keys: ${Object.keys(updates).join(', ')}`);
  } catch (error: any) {
    console.error('Failed to update .env file:', error.message);
    throw error;
  }
}
