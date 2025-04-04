"use client";

import { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import {
  Download,
  Link,
  AlertCircle,
  Video,
  Music,
  Info,
  Loader2,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Cookies from "js-cookie";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "../components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Format,
  checkApiStatus,
  getFormats,
  getVideoInfo,
  DownloadProgress,
  VideoInfo,
} from "@/lib/api";
import { API_ENDPOINTS } from "@/lib/config";
import { DownloadLogRef } from "@/components/download-log";

const formSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  format: z.string(),
  output_dir: z.string(),
  optimize_for_quicktime: z.boolean(),
});

type FormSchema = z.infer<typeof formSchema>;

// Filter and group formats by type
function organizeFormats(formats: Format[]) {
  const videoFormats = formats
    .filter(
      (f) =>
        f.vcodec !== "none" &&
        !f.format_note.includes("storyboard") &&
        f.resolution !== "N/A"
    )
    .sort((a, b) => {
      const resA = parseInt(a.resolution.split("p")[0]) || 0;
      const resB = parseInt(b.resolution.split("p")[0]) || 0;
      return resB - resA;
    });

  const audioFormats = formats
    .filter((f) => f.vcodec === "none" && f.acodec !== "none")
    .sort((a, b) => {
      const sizeA = typeof a.filesize === "number" ? a.filesize : 0;
      const sizeB = typeof b.filesize === "number" ? b.filesize : 0;
      return sizeB - sizeA;
    });

  return { videoFormats, audioFormats };
}

export default function Home() {
  const [formats, setFormats] = useState<Format[]>([]);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [isLoadingFormats, setIsLoadingFormats] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState<boolean>(true);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloadLink, setDownloadLink] = useState<{
    url: string;
    filename: string;
    size_mb: number;
    expires_in_minutes: number;
    created_at: number;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const logRef = useRef<DownloadLogRef>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholders = [
    "https://youtube.com/watch?v=...",
    "https://vimeo.com/...",
    "https://instagram.com/p/...",
    "https://facebook.com/watch/...",
    "https://tiktok.com/@user/video/...",
    "https://twitter.com/user/status/...",
  ];

  const [loadingStep, setLoadingStep] = useState<{
    message: string;
    substep?: string;
  } | null>(null);

  // Loading steps sequence
  const loadingSteps = [
    {
      message: "Receiving Request",
      substeps: ["Processing HTTP request", "Validating parameters"],
    },
    {
      message: "Setting Up Environment",
      substeps: [
        "Initializing logging",
        "Setting up encoders",
        "Checking versions",
      ],
    },
    {
      message: "Validating URL",
      substeps: [
        "Verifying URL format",
        "Loading necessary cookies",
        "Checking extraction mode",
      ],
    },
    {
      message: "Extracting Metadata",
      substeps: [
        "Downloading webpage",
        "Loading client config",
        "Processing player API",
      ],
    },
    {
      message: "Processing Signatures",
      substeps: [
        "Extracting signature functions",
        "Decrypting nsig values",
        "Caching stream URLs",
      ],
    },
    {
      message: "Selecting Formats",
      substeps: [
        "Analyzing available formats",
        "Checking compatibility",
        "Selecting best match",
      ],
    },
    {
      message: "Preparing Download",
      substeps: [
        "Setting up streams",
        "Initializing temporary storage",
        "Configuring download",
      ],
    },
  ];

  const simulateLoading = async (totalSizeMB: number) => {
    // Base time ranges for different types of steps (in milliseconds)
    const baseTimings = {
      "Receiving Request": { min: 800, max: 1500 },
      "Setting Up Environment": { min: 1500, max: 2500 },
      "Validating URL": { min: 4000, max: 5000 },
      "Extracting Metadata": { min: 2000, max: 3500 },
      "Processing Signatures": { min: 6000, max: 8000 },
      "Selecting Formats": { min: 1500, max: 2500 },
      "Preparing Download": { min: 1000, max: 2000 },
    };

    // Scale factor based on file size (increases by 40% for every 100MB)
    const scaleFactor = 1 + (totalSizeMB / 100) * 0.4;

    // Helper function to get random time between min and max
    const getRandomTime = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1) + min);

    // Helper function to scale timing based on file size
    const getScaledTiming = (timing: { min: number; max: number }) => ({
      min: timing.min * scaleFactor,
      max: timing.max * scaleFactor,
    });

    for (const step of loadingSteps) {
      setLoadingStep({ message: step.message });

      // Get base timing range for this step and scale it
      const baseTiming = baseTimings[step.message as keyof typeof baseTimings];
      const scaledTiming = getScaledTiming(baseTiming);

      // Calculate step time with scaled values
      const stepTime = getRandomTime(scaledTiming.min, scaledTiming.max);

      // Special handling for certain steps that are more affected by file size
      const sizeAffectedSteps = [
        "Processing Signatures",
        "Extracting Metadata",
        "Preparing Download",
      ];

      const timePerSubstep = sizeAffectedSteps.includes(step.message)
        ? (stepTime * (1 + totalSizeMB / 200)) / step.substeps.length // More scaling for size-affected steps
        : stepTime / step.substeps.length;

      // Show substeps with varying times
      for (const substep of step.substeps) {
        setLoadingStep({ message: step.message, substep });
        // Vary each substep time by ±50%
        const variance = timePerSubstep * 0.5;
        const substepTime = getRandomTime(
          timePerSubstep - variance,
          timePerSubstep + variance
        );
        await new Promise((resolve) => setTimeout(resolve, substepTime));
      }
    }
  };

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
      output_dir: "./downloads",
      optimize_for_quicktime: false,
    },
  });

  useEffect(() => {
    const checkApi = async () => {
      const isAvailable = await checkApiStatus();
      console.log("🔍 [API] Status check result:", isAvailable);
      setIsApiAvailable(isAvailable);
      if (!isAvailable) {
        toast.error(
          "Unable to connect to the API server. Please make sure it's running."
        );
      }
    };
    checkApi();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % placeholders.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [placeholders.length]);

  // Load download link from cookie on mount
  useEffect(() => {
    const savedDownloadLink = Cookies.get("downloadLink");
    if (savedDownloadLink) {
      try {
        const parsedLink = JSON.parse(savedDownloadLink);
        // Only restore if the link hasn't expired
        const expiryTime =
          parsedLink.created_at + parsedLink.expires_in_minutes * 60 * 1000;
        if (Date.now() < expiryTime) {
          setDownloadLink(parsedLink);
        } else {
          // Clean up expired cookie
          Cookies.remove("downloadLink");
        }
      } catch (error) {
        console.error("Failed to parse saved download link:", error);
        Cookies.remove("downloadLink");
      }
    }
  }, []);

  // Update cookie when download link changes
  useEffect(() => {
    if (downloadLink) {
      Cookies.set("downloadLink", JSON.stringify(downloadLink), {
        expires: downloadLink.expires_in_minutes / (24 * 60), // Convert minutes to days for cookie expiry
      });
    } else {
      Cookies.remove("downloadLink");
    }
  }, [downloadLink]);

  // Add countdown timer effect
  useEffect(() => {
    if (!downloadLink?.created_at) return;

    const updateTimeLeft = () => {
      const now = Date.now();
      const expiryTime =
        downloadLink.created_at + downloadLink.expires_in_minutes * 60 * 1000;
      const diff = expiryTime - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        setDownloadLink(null);
        Cookies.remove("downloadLink"); // Clean up cookie when link expires
        return;
      }

      // Calculate hours, minutes, and seconds
      const totalMinutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Format the time string
      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    // Update immediately
    updateTimeLeft();

    // Update every second
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [downloadLink?.created_at, downloadLink?.expires_in_minutes]);

  const onSubmit = async (values: FormSchema) => {
    if (!isApiAvailable) {
      toast.error("API server is not available");
      return;
    }

    try {
      setIsLoadingInfo(true);
      setDownloadProgress(null);
      setVideoInfo(null);
      setDownloadLink(null);

      // Clear previous logs
      if (logRef.current) {
        logRef.current.clear();
      }

      // Get video info first
      const info = await getVideoInfo(values);
      setVideoInfo(info);

      // Start the download process
      setIsGeneratingDownload(true);

      // Calculate total size for loading simulation
      let sizeMB = 0;
      if (
        values.format === "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]"
      ) {
        // If best quality, find the largest video file
        const largestVideo = formats[0];
        if (largestVideo) {
          sizeMB = parseFloat(largestVideo.filesize_mb) || 100; // Default to 100MB if size unknown
        }
      } else {
        // Find the selected format
        const selectedFormat = [...formats].find(
          (f) => f.format_id === values.format
        );
        if (selectedFormat) {
          sizeMB = parseFloat(selectedFormat.filesize_mb) || 50; // Default to 50MB if size unknown
        }
      }
      // setTotalSizeMB(sizeMB);

      // Simulate loading steps
      await simulateLoading(sizeMB);

      const response = await fetch(API_ENDPOINTS.download, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to generate download link");
      }

      const downloadData = await response.json();
      // Construct the download URL using the token
      const downloadUrl = `${API_ENDPOINTS.download}/${downloadData.token}`;

      setDownloadLink({
        ...downloadData,
        url: downloadUrl,
        created_at: Date.now(),
      });
      toast.success("Download link generated!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to process media"
      );
    } finally {
      setIsLoadingInfo(false);
      setIsGeneratingDownload(false);
      setLoadingStep(null);
    }
  };

  // Helper function to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const fetchFormats = async (url: string) => {
    if (!isApiAvailable) {
      toast.error("API server is not available");
      return;
    }

    try {
      setIsLoadingFormats(true);
      const response = await getFormats(url);
      setFormats(response.formats);
      setVideoTitle(response.title);
      toast.success("Formats fetched successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoadingFormats(false);
    }
  };

  const { videoFormats, audioFormats } = organizeFormats(formats);

  return (
    <div className="min-h-screen p-8">
      <Toaster position="bottom-right" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto space-y-8"
      >
        {!isApiAvailable && (
          <div className="flex items-center gap-2 p-4 text-sm text-yellow-800 bg-yellow-50 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <div className="space-y-1">
              <p>API server is not accessible. This might be due to:</p>
              <ul className="list-disc list-inside pl-2">
                <li>CORS not being enabled on the backend</li>
                <li>The server not running at http://localhost:8000</li>
              </ul>
              <p className="text-xs mt-2">
                Check the browser console for more details.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-6 h-6" />
              Media Downloader
            </CardTitle>
            <CardDescription>
              Download videos from YouTube, Instagram, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Video URL</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="relative bg-transparent"
                          />
                          <div className="absolute inset-0 pointer-events-none">
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={placeholderIndex}
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 0.5 }}
                                exit={{ y: -10, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="text-sm block pt-3 px-3 py-2 text-muted-foreground"
                              >
                                {!field.value && placeholders[placeholderIndex]}
                              </motion.span>
                            </AnimatePresence>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fetchFormats(form.getValues("url"))}
                  disabled={
                    isLoadingFormats ||
                    !form.getValues("url") ||
                    !isApiAvailable
                  }
                  className="w-full"
                >
                  {isLoadingFormats ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Fetching Formats...
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4 mr-2" />
                      Get Formats
                    </>
                  )}
                </Button>

                {videoTitle && (
                  <div className="text-sm font-medium text-muted-foreground">
                    Video Title: {videoTitle}
                  </div>
                )}

                {formats.length > 0 && (
                  <>
                    <FormField
                      control={form.control}
                      name="format"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Format</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-full w-full">
                                <SelectValue placeholder="Select a format" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]">
                                <div className="flex items-center justify-between w-full">
                                  <span>Best Quality (MP4)</span>
                                  <span className="ml-1 rounded-full bg-muted px-2.5 py-0.5 text-[0.65rem] sm:text-xs font-medium text-muted-foreground shrink-0">
                                    Recommended
                                  </span>
                                </div>
                              </SelectItem>

                              {videoFormats.length > 0 && (
                                <>
                                  <SelectItem value="separator-video" disabled>
                                    <span className="flex items-center">
                                      <Video className="w-4 h-4 mr-2" />
                                      Video Formats
                                    </span>
                                  </SelectItem>
                                  {videoFormats.map((format) => (
                                    <SelectItem
                                      key={format.format_id}
                                      value={format.format_id}
                                      className="py-3"
                                    >
                                      <div className="flex flex-col gap-1.5 min-h-[2.5rem]">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-medium text-sm sm:text-base">
                                            {format.resolution} ({format.ext})
                                          </span>
                                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[0.65rem] sm:text-xs font-medium text-muted-foreground shrink-0">
                                            {format.filesize_mb}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] sm:text-xs text-muted-foreground">
                                          <span>
                                            Bitrate: {format.total_bitrate}
                                          </span>
                                          {format.fps && (
                                            <span>{format.fps}fps</span>
                                          )}
                                          {format.dynamic_range && (
                                            <span>{format.dynamic_range}</span>
                                          )}
                                        </div>
                                        {format.filesize_mb == "N/A" && (
                                          <div className="text-[0.65rem] sm:text-xs text-muted-foreground">
                                            {format.description}
                                          </div>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </>
                              )}

                              {audioFormats.length > 0 && (
                                <>
                                  <SelectItem value="separator-audio" disabled>
                                    <span className="flex items-center">
                                      <Music className="w-4 h-4 mr-2" />
                                      Audio Formats
                                    </span>
                                  </SelectItem>
                                  {audioFormats.map((format) => (
                                    <SelectItem
                                      key={format.format_id}
                                      value={format.format_id}
                                      className="py-3"
                                    >
                                      <div className="flex flex-col gap-1.5 min-h-[2.5rem]">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-medium text-sm sm:text-base">
                                            {format.format_note} ({format.ext})
                                          </span>
                                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[0.65rem] sm:text-xs font-medium text-muted-foreground shrink-0">
                                            {format.filesize_mb}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] sm:text-xs text-muted-foreground">
                                          <span>
                                            Bitrate: {format.audio_bitrate}
                                          </span>
                                          <span>{format.acodec}</span>
                                        </div>
                                        {format.filesize_mb == "N/A" && (
                                          <div className="text-[0.65rem] sm:text-xs text-muted-foreground">
                                            {format.description}
                                          </div>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="optimize_for_quicktime"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              <span className="flex items-center gap-2 pr-3">
                                Optimize for QuickTime (Slower)
                                <button
                                  type="button"
                                  className="sm:hidden text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    toast.info(
                                      "Converts video to H.264/AAC format for better compatibility with QuickTime Player"
                                    );
                                  }}
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              </span>
                            </FormLabel>
                            <FormDescription className="hidden sm:block">
                              Convert video to H.264/AAC format for better
                              compatibility with QuickTime Player
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {downloadProgress && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Downloading video...</span>
                          <span>
                            {Math.round(downloadProgress.percentage)}%
                          </span>
                        </div>
                        <Progress
                          value={downloadProgress.percentage}
                          className="w-full"
                        />
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(downloadProgress.loaded)}
                          {videoInfo && ` / ${videoInfo.filesize_formatted}`}
                        </div>
                      </div>
                    )}

                    {isLoadingInfo || isGeneratingDownload ? (
                      <div className="w-full border rounded-lg p-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <div className="flex flex-col items-start overflow-hidden min-h-[3.5rem] justify-center">
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={loadingStep?.message}
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -10, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="text-sm font-medium"
                              >
                                {loadingStep?.message || "Preparing..."}
                              </motion.span>
                            </AnimatePresence>
                            {loadingStep?.substep && (
                              <AnimatePresence mode="wait">
                                <motion.span
                                  key={loadingStep.substep}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="text-xs text-muted-foreground whitespace-nowrap"
                                >
                                  {loadingStep.substep}
                                </motion.span>
                              </AnimatePresence>
                            )}
                          </div>
                        </div>

                        {/* Progress indicator */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden"
                        >
                          <motion.div
                            className="absolute inset-y-0 left-0 bg-primary"
                            initial={{ width: "0%" }}
                            animate={{
                              width: loadingStep
                                ? `${
                                    ((loadingSteps.findIndex(
                                      (s) => s.message === loadingStep.message
                                    ) +
                                      1) /
                                      loadingSteps.length) *
                                    100
                                  }%`
                                : "0%",
                            }}
                            transition={{
                              duration: 0.1,
                              ease: "linear",
                            }}
                          />
                        </motion.div>
                      </div>
                    ) : (
                      <Button
                        type="submit"
                        disabled={!isApiAvailable}
                        className="w-full"
                      >
                        Download
                      </Button>
                    )}
                  </>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        {downloadLink && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Download Ready</CardTitle>
                <CardDescription>
                  Your download link is ready. Click below to start downloading.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">{downloadLink.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      Size: {downloadLink.size_mb.toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(downloadLink.url);
                          toast.success("Download link copied to clipboard!");
                        } catch (err) {
                          toast.error("Failed to copy link: " + err);
                        }
                      }}
                      className="min-w-[120px]"
                    >
                      <motion.span
                        className="flex items-center gap-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </motion.span>
                    </Button>
                    <Button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = downloadLink.url;
                        a.download = downloadLink.filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="min-w-[120px]"
                    >
                      <motion.span
                        className="flex items-center gap-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </motion.span>
                    </Button>
                  </div>
                </div>
                <motion.p
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Link expires in {timeLeft}
                </motion.p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
