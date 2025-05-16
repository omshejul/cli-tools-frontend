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
  Check,
  Copy,
  Terminal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Cookies from "js-cookie";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Format,
  checkApiStatus,
  getFormats,
  DownloadProgress,
  VideoInfo,
} from "@/lib/api";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/config";
import { DownloadLogRef } from "@/components/download-log";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [isShared, setIsShared] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isMacCopied, setIsMacCopied] = useState(false);
  const [isLinuxCopied, setIsLinuxCopied] = useState(false);
  const [isWinCopied, setIsWinCopied] = useState(false);
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
    progress: number;
  } | null>(null);

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
          "Unable to connect to the API server. Please make sure it is running."
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

      // Start the download process immediately
      setIsGeneratingDownload(true);
      setLoadingStep({
        message: "Fetching video information",
        progress: 25,
      });

      // Get video info first
      const videoInfoResponse = await fetch(API_ENDPOINTS.info, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!videoInfoResponse.ok) {
        const error = await videoInfoResponse.json();
        throw new Error(error.detail || "Failed to get video info");
      }

      const videoInfo = await videoInfoResponse.json();
      setVideoInfo(videoInfo);

      setLoadingStep({
        message: "Processing video",
        substep: "Downloading video on server",
        progress: 50,
      });

      // Send the download request
      const downloadResponse = await fetch(API_ENDPOINTS.download, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!downloadResponse.ok) {
        const error = await downloadResponse.json();
        throw new Error(error.detail || "Failed to generate download link");
      }

      setLoadingStep({
        message: "Generating download link",
        substep: "Almost there...",
        progress: 90,
      });

      const downloadData = await downloadResponse.json();
      const downloadUrl = `${API_ENDPOINTS.download}/${downloadData.token}`;

      setLoadingStep({
        message: "Download ready",
        progress: 100,
      });

      setDownloadLink({
        ...downloadData,
        url: downloadUrl,
        created_at: Date.now(),
      });

      // Clear loading states
      setLoadingStep(null);
      setIsLoadingInfo(false);
      setIsGeneratingDownload(false);

      toast.success("Download link generated!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to process media"
      );
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

  const isLikelyUrl = (text: string): boolean => {
    // Checks for domain-like patterns
    const urlPattern =
      /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/i;
    return (
      urlPattern.test(text) && !text.endsWith(".mp4") && !text.endsWith(".mp3")
    );
  };

  const { videoFormats, audioFormats } = organizeFormats(formats);

  return (
    <div className="p-8">
      <Toaster position="bottom-right" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto space-y-8"
        aria-hidden={false}
      >
        {!isApiAvailable && (
          <div className="flex items-center gap-2 p-4 text-sm text-yellow-800 bg-yellow-50 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <div className="space-y-1">
              <p>API server is not accessible. This might be due to:</p>
              <ul className="list-disc list-inside pl-2">
                <li>CORS not being enabled on the backend</li>
                <li>The server not running at {API_BASE_URL}</li>
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
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const url = form.getValues("url");
                                if (
                                  url &&
                                  !isLoadingFormats &&
                                  isApiAvailable &&
                                  isLikelyUrl(url)
                                ) {
                                  fetchFormats(url);
                                }
                              }
                            }}
                            onPaste={() => {
                              // Allow the default paste behavior to complete
                              setTimeout(() => {
                                const url = form.getValues("url");
                                if (
                                  url &&
                                  !isLoadingFormats &&
                                  isApiAvailable &&
                                  isLikelyUrl(url)
                                ) {
                                  fetchFormats(url);
                                }
                              }, 100);
                            }}
                          />
                          <div className="absolute inset-0 pointer-events-none">
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={placeholderIndex}
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 0.5 }}
                                exit={{ y: -10, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="text-sm block pt-3 px-4 py-2 text-muted-foreground"
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

                              <Tabs
                                defaultValue="video"
                                className="w-full mt-2"
                              >
                                <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger
                                    value="video"
                                    className="flex items-center gap-2"
                                  >
                                    <Video className="w-4 h-4" />
                                    Video
                                  </TabsTrigger>
                                  <TabsTrigger
                                    value="audio"
                                    className="flex items-center gap-2"
                                  >
                                    <Music className="w-4 h-4" />
                                    Audio
                                  </TabsTrigger>
                                </TabsList>
                                <TabsContent value="video" className="mt-2">
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
                                </TabsContent>
                                <TabsContent value="audio" className="mt-2">
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
                                </TabsContent>
                              </Tabs>
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
                              <span className="flex flex-wrap items-center gap-2 pr-3">
                                Optimize for Apple QuickTime (112x Slower)
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
                                <Drawer>
                                  <DrawerTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1 flex items-center gap-1"
                                    >
                                      <Terminal className="h-3 w-3" />
                                      Convert manually
                                    </button>
                                  </DrawerTrigger>
                                  <DrawerContent>
                                    <div
                                      className="max-w-2xl mx-auto px-4"
                                      tabIndex={-1}
                                    >
                                      <DrawerHeader>
                                        <DrawerTitle>
                                          Manual Conversion with FFmpeg
                                        </DrawerTitle>
                                        <DrawerDescription>
                                          Use this command to convert your video
                                          for QuickTime compatibility
                                        </DrawerDescription>
                                      </DrawerHeader>
                                      <div className="p-4">
                                        <div className="font-mono text-sm bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
                                          <div
                                            className="p-4 overflow-x-auto border-b border-slate-200 dark:border-slate-800"
                                            tabIndex={0}
                                            role="textbox"
                                            aria-label="FFmpeg command"
                                          >
                                            {`ffmpeg -i "path/to/file/${
                                              downloadLink?.filename ||
                                              "video.mp4"
                                            }" -c:v libx264 -c:a aac -b:a 192k -movflags +faststart -pix_fmt yuv420p "path/to/file/${
                                              downloadLink?.filename?.replace(
                                                /\.[^/.]+$/,
                                                ""
                                              ) || "video"
                                            }-quicktime.mp4"`}
                                          </div>
                                          <div className="p-2">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8"
                                              onClick={() => {
                                                const filename =
                                                  downloadLink?.filename ||
                                                  "input.mp4";
                                                const outputName =
                                                  filename.replace(
                                                    /\.[^/.]+$/,
                                                    ""
                                                  ) + "-quicktime.mp4";
                                                const command = `ffmpeg -i "path/to/file/${filename}" -c:v libx264 -c:a aac -b:a 192k -movflags +faststart -pix_fmt yuv420p "path/to/file/${outputName}"`;
                                                navigator.clipboard.writeText(
                                                  command
                                                );
                                                setIsCopied(true);
                                                setTimeout(
                                                  () => setIsCopied(false),
                                                  2000
                                                );
                                                toast.success(
                                                  "Command copied!"
                                                );
                                              }}
                                              aria-label={
                                                isCopied
                                                  ? "Command copied"
                                                  : "Copy command"
                                              }
                                            >
                                              {isCopied ? (
                                                <Check className="h-4 w-4 mr-2" />
                                              ) : (
                                                <Copy className="h-4 w-4 mr-2" />
                                              )}
                                              {isCopied
                                                ? "Copied!"
                                                : "Copy command"}
                                            </Button>
                                            <Dialog>
                                              <DialogTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8"
                                                >
                                                  <Download className="h-4 w-4 mr-2" />
                                                  FFmpeg not installed?
                                                </Button>
                                              </DialogTrigger>
                                              <DialogContent className="sm:max-w-[425px]">
                                                <DialogHeader>
                                                  <DialogTitle>
                                                    Install FFmpeg
                                                  </DialogTitle>
                                                  <DialogDescription>
                                                    Follow the instructions
                                                    below to install FFmpeg on
                                                    your system.
                                                  </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                  <div>
                                                    <h4 className="font-medium mb-2">
                                                      macOS
                                                    </h4>
                                                    <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-3 flex items-center justify-between">
                                                      <code>
                                                        brew install ffmpeg
                                                      </code>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2"
                                                        onClick={() => {
                                                          navigator.clipboard.writeText(
                                                            "brew install ffmpeg"
                                                          );
                                                          setIsMacCopied(true);
                                                          setTimeout(
                                                            () =>
                                                              setIsMacCopied(
                                                                false
                                                              ),
                                                            2000
                                                          );
                                                          toast.success(
                                                            "Command copied!"
                                                          );
                                                        }}
                                                      >
                                                        {isMacCopied ? (
                                                          <Check className="h-3 w-3" />
                                                        ) : (
                                                          <Copy className="h-3 w-3" />
                                                        )}
                                                      </Button>
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <h4 className="font-medium mb-2">
                                                      Windows
                                                    </h4>
                                                    <div className="space-y-3">
                                                      <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-3 flex items-center justify-between">
                                                        <code>
                                                          winget install ffmpeg
                                                        </code>
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-6 px-2"
                                                          onClick={() => {
                                                            navigator.clipboard.writeText(
                                                              "winget install ffmpeg"
                                                            );
                                                            setIsWinCopied(
                                                              true
                                                            );
                                                            setTimeout(
                                                              () =>
                                                                setIsWinCopied(
                                                                  false
                                                                ),
                                                              2000
                                                            );
                                                            toast.success(
                                                              "Command copied!"
                                                            );
                                                          }}
                                                        >
                                                          {isWinCopied ? (
                                                            <Check className="h-3 w-3" />
                                                          ) : (
                                                            <Copy className="h-3 w-3" />
                                                          )}
                                                        </Button>
                                                      </div>
                                                      <p className="text-sm text-muted-foreground">
                                                        Or manually:
                                                      </p>
                                                      <ol className="list-decimal list-inside space-y-2 text-sm">
                                                        <li>
                                                          Download the latest
                                                          build from{" "}
                                                          <a
                                                            href="https://github.com/BtbN/FFmpeg-Builds/releases"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary underline hover:underline-offset-4 hover:underline"
                                                          >
                                                            FFmpeg Builds
                                                          </a>
                                                        </li>
                                                        <li>
                                                          Extract the ZIP file
                                                        </li>
                                                        <li>
                                                          Add the bin folder to
                                                          your system&apos;s
                                                          PATH
                                                        </li>
                                                      </ol>
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <h4 className="font-medium mb-2">
                                                      Linux (Ubuntu/Debian)
                                                    </h4>
                                                    <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-3 flex items-center justify-between">
                                                      <code>
                                                        sudo apt install ffmpeg
                                                      </code>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2"
                                                        onClick={() => {
                                                          navigator.clipboard.writeText(
                                                            "sudo apt install ffmpeg"
                                                          );
                                                          setIsLinuxCopied(
                                                            true
                                                          );
                                                          setTimeout(
                                                            () =>
                                                              setIsLinuxCopied(
                                                                false
                                                              ),
                                                            2000
                                                          );
                                                          toast.success(
                                                            "Command copied!"
                                                          );
                                                        }}
                                                      >
                                                        {isLinuxCopied ? (
                                                          <Check className="h-3 w-3" />
                                                        ) : (
                                                          <Copy className="h-3 w-3" />
                                                        )}
                                                      </Button>
                                                    </div>
                                                  </div>
                                                  <div className="text-sm text-muted-foreground mt-4">
                                                    For more information, visit
                                                    the{" "}
                                                    <a
                                                      href="https://ffmpeg.org/download.html"
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-primary hover:underline"
                                                    >
                                                      official FFmpeg website
                                                    </a>
                                                    .
                                                  </div>
                                                </div>
                                              </DialogContent>
                                            </Dialog>
                                          </div>
                                        </div>
                                        <p className="mt-4 text-sm text-muted-foreground">
                                          This command:
                                        </p>
                                        <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                          <li>
                                            Converts video to H.264 codec
                                            (QuickTime compatible)
                                          </li>
                                          <li>
                                            Converts audio to AAC format at
                                            192kbps
                                          </li>
                                          <li>
                                            Enables fast start for instant
                                            playback
                                          </li>
                                          <li>
                                            Uses compatible color format
                                            (yuv420p)
                                          </li>
                                        </ul>
                                      </div>
                                      <DrawerFooter>
                                        <DrawerClose asChild>
                                          <Button variant="outline">
                                            Close
                                          </Button>
                                        </DrawerClose>
                                      </DrawerFooter>
                                    </div>
                                  </DrawerContent>
                                </Drawer>
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
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
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
                                ? `${loadingStep.progress}%`
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
                          setIsShared(true);
                          setTimeout(() => setIsShared(false), 2000);
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
                        {isShared ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {isShared ? "Copied!" : "Copy Link"}
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
