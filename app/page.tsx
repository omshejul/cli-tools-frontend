"use client";

import { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import { Download, Link, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormatResponse,
  checkApiStatus,
  getFormats,
  downloadVideo,
} from "@/lib/api";
import { DownloadLog, DownloadLogRef } from "@/components/download-log";

const formSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  format: z.string(),
  output_dir: z.string(),
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

function formatFileSize(size: number | "N/A") {
  if (size === "N/A") return "N/A";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${(bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export default function Home() {
  const [formats, setFormats] = useState<Format[]>([]);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState<boolean>(true);
  const logRef = useRef<DownloadLogRef>(null);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
      output_dir: "./downloads",
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

  const onSubmit = async (values: FormSchema) => {
    if (!isApiAvailable) {
      toast.error("API server is not available");
      return;
    }

    try {
      setLoading(true);

      // Clear previous logs
      if (logRef.current) {
        logRef.current.clear();
      }

      // Start the download process
      toast.success("Starting download process...");

      const response = await downloadVideo({
        ...values,
      });

      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "download";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename\*=UTF-8''(.+)/i
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      // Get the blob from the streaming response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("File saved successfully!");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
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
              YouTube Downloader
            </CardTitle>
            <CardDescription>
              Download videos from YouTube using yt-dlp
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
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://youtube.com/..."
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fetchFormats(field.value)}
                            disabled={
                              loading || !field.value || !isApiAvailable
                            }
                          >
                            <Link className="w-4 h-4 mr-2" />
                            Get Formats
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {videoTitle && (
                  <div className="text-sm font-medium text-muted-foreground">
                    Video Title: {videoTitle}
                  </div>
                )}

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
                          <SelectTrigger>
                            <SelectValue placeholder="Select a format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]">
                            Best Quality (MP4)
                          </SelectItem>

                          {videoFormats.length > 0 && (
                            <>
                              <SelectItem value="separator-video" disabled>
                                Video Formats
                              </SelectItem>
                              {videoFormats.map((format) => (
                                <SelectItem
                                  key={format.format_id}
                                  value={format.format_id}
                                >
                                  {format.resolution} ({format.ext}) -{" "}
                                  {formatFileSize(format.filesize)}
                                </SelectItem>
                              ))}
                            </>
                          )}

                          {audioFormats.length > 0 && (
                            <>
                              <SelectItem value="separator-audio" disabled>
                                Audio Only
                              </SelectItem>
                              {audioFormats.map((format) => (
                                <SelectItem
                                  key={format.format_id}
                                  value={format.format_id}
                                >
                                  {format.format_note} ({format.ext}) -{" "}
                                  {formatFileSize(format.filesize)}
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

                <div className="mt-4 border rounded-md">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">
                    Download Logs
                  </div>
                  <DownloadLog ref={logRef} className="h-[200px]" />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !isApiAvailable}
                  className="w-full"
                >
                  {loading ? "Processing..." : "Download"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
