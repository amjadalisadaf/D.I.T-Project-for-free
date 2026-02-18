import { ChangeDetectionStrategy, Component, inject, signal, afterNextRender, ElementRef, QueryList, ViewChildren } from '@angular/core';
// FIX: Import FormGroup to explicitly type the contactForm property.
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { GeminiService, GenerationResult } from './services/gemini.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  aboutMe = signal<GenerationResult | null>(null);
  projects = signal<GenerationResult | null>(null);

  loadingAbout = signal(false);
  loadingProjects = signal(false);
  error = signal<string | null>(null);
  
  initialAboutText = "An aspiring and dedicated student pursuing a Diploma in Information Technology, with a strong foundation in web development technologies. Passionate about creating intuitive and dynamic user experiences.";
  initialProjectsText = "Click the button above to generate project ideas using Google's latest AI models with up-to-date information from Google Search.";

  @ViewChildren('animatedSection') animatedSections!: QueryList<ElementRef>;
  private observer?: IntersectionObserver;

  // Image Generation State
  imagePrompt = signal('A stunning futuristic cityscape at sunset, with flying cars and neon lights.');
  generatedImage = signal<string | null>(null);
  loadingImage = signal(false);

  // Video Generation State
  videoPrompt = signal('The camera pans across the cityscape, showing the vibrant life.');
  uploadedImage = signal<{base64: string; name: string; mimeType: string} | null>(null);
  aspectRatio = signal<'16:9' | '9:16'>('16:9');
  loadingVideo = signal(false);
  videoGenerationStatus = signal<string | null>(null);
  generatedVideoUrl = signal<string | null>(null);

  // Contact Form State
  private fb = inject(FormBuilder);
  // FIX: Declare contactForm property here and initialize it in the constructor.
  // This is a more robust pattern and resolves potential type inference issues.
  contactForm: FormGroup;
  submissionStatus = signal<'idle' | 'success' | 'error'>('idle');

  constructor() {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      message: ['', Validators.required],
    });

    this.aboutMe.set({text: this.initialAboutText, sources: []});
    this.projects.set({text: this.initialProjectsText, sources: []});
    afterNextRender(() => {
      this.setupIntersectionObserver();
    });
  }

  private setupIntersectionObserver(): void {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          this.observer?.unobserve(entry.target);
        }
      });
    }, options);

    this.animatedSections.forEach(section => {
      this.observer?.observe(section.nativeElement);
    });
  }

  async generateAbout(): Promise<void> {
    this.loadingAbout.set(true);
    this.error.set(null);
    this.aboutMe.set(null);

    const prompt = `Generate a professional 'About Me' section for a portfolio for Muskan Khan, a DIT (Diploma in Information Technology) student with an expected graduation year of 2026. The tone should be enthusiastic and professional. Highlight key interests like full-stack development, UI/UX design, and cloud computing. Keep it concise, around 3-4 sentences.`;

    try {
      const result = await this.geminiService.generateContentWithSearch(prompt);
      this.aboutMe.set(result);
    } catch (e: any) {
      this.error.set(e.message || 'An unknown error occurred.');
      this.aboutMe.set({text: this.initialAboutText, sources: []});
    } finally {
      this.loadingAbout.set(false);
    }
  }

  async generateProjects(): Promise<void> {
    this.loadingProjects.set(true);
    this.error.set(null);
    this.projects.set(null);

    const prompt = `Generate a list of 3 fictional but impressive web development project ideas suitable for the portfolio of a student named Muskan Khan, a DIT student graduating in 2026. For each project, provide a name, a one-sentence description, and a list of key technologies used. Format the output as a clean, readable list. Use markdown-style headings for project names.`;

    try {
      const result = await this.geminiService.generateContentWithSearch(prompt);
      this.projects.set(result);
    } catch (e: any) {
      this.error.set(e.message || 'An unknown error occurred.');
      this.projects.set({text: this.initialProjectsText, sources: []});
    } finally {
      this.loadingProjects.set(false);
    }
  }

  // Image Generation Logic
  async generateImage(): Promise<void> {
    if (!this.imagePrompt()) return;
    this.loadingImage.set(true);
    this.generatedImage.set(null);
    this.error.set(null);
    try {
      const images = await this.geminiService.generateImage(this.imagePrompt());
      if (images.length > 0 && images[0].imageBytes) {
        this.generatedImage.set(`data:image/jpeg;base64,${images[0].imageBytes}`);
      }
    } catch (e: any) {
      this.error.set(e.message || 'An unknown error occurred while generating the image.');
    } finally {
      this.loadingImage.set(false);
    }
  }

  // Video Generation Logic
  handleImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        this.uploadedImage.set({
          base64,
          name: file.name,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
  }

  async generateVideo(): Promise<void> {
    const image = this.uploadedImage();
    if (!image) {
      this.error.set('Please upload an image first.');
      return;
    }

    this.loadingVideo.set(true);
    this.generatedVideoUrl.set(null);
    this.error.set(null);
    this.videoGenerationStatus.set('Initializing video generation...');

    try {
      let operation = await this.geminiService.generateVideo(
        this.videoPrompt(),
        { imageBytes: image.base64, mimeType: image.mimeType },
        this.aspectRatio()
      );
      this.videoGenerationStatus.set('Video generation started. Polling for results... this can take a few minutes.');
      
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        this.videoGenerationStatus.set('Still working... Checking for updates.');
        operation = await this.geminiService.getVideosOperation(operation);
      }
      
      this.videoGenerationStatus.set('Video processing complete!');
      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;

      if (videoUri) {
        const apiKey = process.env.API_KEY;
        const response = await fetch(`${videoUri}&key=${apiKey}`);
        if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
        const videoBlob = await response.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        this.generatedVideoUrl.set(videoUrl);
        this.videoGenerationStatus.set(null);
      } else {
        throw new Error('Video URI was not found in the operation response.');
      }
      
    } catch (e: any) {
      const errorMessage = e.message || 'An unknown error occurred during video generation.';
      this.error.set(errorMessage);
      this.videoGenerationStatus.set(`Error: ${errorMessage}`);
    } finally {
      this.loadingVideo.set(false);
    }
  }

  // Contact Form Logic
  onSubmitContact(): void {
    if (this.contactForm.valid) {
      console.log('Form Submitted:', this.contactForm.value);
      this.submissionStatus.set('success');
      this.contactForm.reset();
      setTimeout(() => this.submissionStatus.set('idle'), 5000);
    } else {
      console.error('Form is invalid');
      this.submissionStatus.set('error');
      // Mark all fields as touched to display validation errors
      this.contactForm.markAllAsTouched();
    }
  }
}