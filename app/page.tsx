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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  downloadVideo,
  DownloadProgress,
  VideoInfo,
} from "@/lib/api";
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
  const [loading, setLoading] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState<boolean>(true);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
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

  const onSubmit = async (values: FormSchema) => {
    if (!isApiAvailable) {
      toast.error("API server is not available");
      return;
    }

    try {
      setLoading(true);
      setDownloadProgress(null);
      setVideoInfo(null);

      // Clear previous logs
      if (logRef.current) {
        logRef.current.clear();
      }

      // Get video info first
      const info = await getVideoInfo(values);
      setVideoInfo(info);

      // Start the download process
      toast.success("Processing media...");

      const blob = await downloadVideo(
        values,
        info,
        (progress: DownloadProgress) => {
          setDownloadProgress(progress);
          if (logRef.current) {
            logRef.current.addLog(
              "info",
              `Downloading: ${progress.percentage.toFixed(1)}% (${formatBytes(
                progress.loaded
              )} / ${info.filesize_formatted})`
            );
          }
        }
      );

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = info.filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Successfully downloaded: ${info.filename}`);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
      setDownloadProgress(null);
      setVideoInfo(null);
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
      setLoading(true);
      const response = await getFormats(url);
      setFormats(response.formats);
      setVideoTitle(response.title);
      toast.success("Formats fetched successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const { videoFormats, audioFormats } = organizeFormats(formats);

  return (
    <div className="min-h-screen p-8">
      <Toaster position="top-center" />
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
                                className="block px-3 py-2 text-muted-foreground"
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
                    loading || !form.getValues("url") || !isApiAvailable
                  }
                  className="w-full"
                >
                  {loading ? (
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
                                Optimize for  QuickTime (Slower)
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

                    <Button
                      type="submit"
                      disabled={loading || !isApiAvailable}
                      className="w-full"
                    >
                      {loading ? "Processing..." : "Download"}
                    </Button>
                  </>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
