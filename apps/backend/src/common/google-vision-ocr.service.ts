import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';

@Injectable()
export class GoogleVisionOcrService {
  private readonly logger = new Logger(GoogleVisionOcrService.name);
  private readonly client: ImageAnnotatorClient;

  constructor() {
    // Initialize Google Cloud Vision client
    // Uses GOOGLE_APPLICATION_CREDENTIALS env var or GOOGLE_CLOUD_VISION_CREDENTIALS
    const credentials = process.env.GOOGLE_CLOUD_VISION_CREDENTIALS;

    if (credentials) {
      try {
        // Parse JSON credentials from env var
        const parsedCredentials = JSON.parse(credentials);
        this.client = new ImageAnnotatorClient({
          credentials: parsedCredentials,
        });
        this.logger.log('Google Cloud Vision client initialized with env credentials');
      } catch (error) {
        this.logger.error('Failed to parse GOOGLE_CLOUD_VISION_CREDENTIALS. Make sure it is valid JSON.');
        this.logger.error(`First 100 chars: ${credentials.substring(0, 100)}`);
        throw new Error(
          'Invalid GOOGLE_CLOUD_VISION_CREDENTIALS format. ' +
          'Must be a valid JSON string (use double quotes, not single quotes). ' +
          `Parse error: ${error.message}`
        );
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use service account key file path
      this.client = new ImageAnnotatorClient();
      this.logger.log('Google Cloud Vision client initialized with service account file');
    } else {
      this.logger.warn('No Google Cloud Vision credentials found. OCR will fail.');
      this.client = new ImageAnnotatorClient();
    }
  }

  /**
   * Extract text from an image using Google Cloud Vision API
   * @param imageBuffer Image buffer (JPEG, PNG, etc)
   * @returns Extracted text
   */
  async extractText(imageBuffer: Buffer): Promise<string> {
    try {
      this.logger.log(`Starting Google Vision OCR on ${imageBuffer.length} byte image...`);

      const [result] = await this.client.textDetection(imageBuffer);

      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        this.logger.warn('No text detected in image');
        return '';
      }

      // First annotation contains all detected text
      const fullText = detections[0]?.description || '';

      this.logger.log(`OCR extracted text (${fullText.length} chars)`);

      return fullText;
    } catch (error) {
      this.logger.error(`Google Vision OCR failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Extract structured data from an image using document text detection
   * Better for receipts/bills with structured layout
   * @param imageBuffer Image buffer
   * @returns Extracted text with layout information
   */
  async extractStructuredText(imageBuffer: Buffer): Promise<string> {
    try {
      this.logger.log(`Starting Google Vision document text detection on ${imageBuffer.length} byte image...`);

      const [result] = await this.client.documentTextDetection(imageBuffer);

      const fullTextAnnotation = result.fullTextAnnotation;

      if (!fullTextAnnotation || !fullTextAnnotation.text) {
        this.logger.warn('No text detected in document');
        return '';
      }

      const text = fullTextAnnotation.text;

      this.logger.log(`Document OCR extracted text (${text.length} chars)`);

      return text;
    } catch (error) {
      this.logger.error(`Google Vision document OCR failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      throw error;
    }
  }
}
