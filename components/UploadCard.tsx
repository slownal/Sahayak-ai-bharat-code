
"use client";

import { useState, useCallback } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Camera, Upload, X } from "lucide-react";
import type { Language, Grade } from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/types";

const GRADES: Grade[] = [6, 7, 8, 9, 10, 11, 12];
const LANGUAGES = Object.entries(LANGUAGE_LABELS) as [Language, string][];

interface Props {
  onSubmit: (data: {
    imageBase64?: string;
    manualText?: string;
    language: Language;
    grade: Grade;
  }) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function UploadCard({
  onSubmit,
  isLoading,
  disabled,
}: Props) {
  const [language, setLanguage] = useState<Language>("en");
  const [grade, setGrade] = useState<Grade>(8);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFile = useCallback((file: File) => {
    setUploadError("");

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image size must be less than 10 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result;

      if (typeof dataUrl !== "string") {
        setUploadError("Could not read the image. Please try again.");
        return;
      }

      const base64 = dataUrl.split(",")[1];

      if (!base64) {
        setUploadError("Could not process the image.");
        return;
      }

      setPreview(dataUrl);
      setImageBase64(base64);
      setShowManual(false);
    };

    reader.onerror = () => {
      setUploadError("Image upload failed. Please try another image.");
    };

    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];

      if (file) handleFile(file);

      e.target.value = "";
    },
    [handleFile]
  );

  const clearImage = () => {
    setPreview(null);
    setImageBase64(null);
    setUploadError("");
  };

  const handleSubmit = () => {
    const text = manualText.trim();

    if (!imageBase64 && !text) return;

    onSubmit({
      ...(imageBase64 ? { imageBase64 } : {}),
      ...(text ? { manualText: text } : {}),
      language,
      grade,
    });
  };

  const canSubmit =
    !isLoading &&
    !disabled &&
    (!!imageBase64 || !!manualText.trim());

  return (
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-md p-6 space-y-5">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-orange-600">
          सहायक
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Your AI tutor for Indian students
        </p>
      </div>

      {/* Image Upload */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative border-2 border-dashed border-orange-300 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors min-h-[160px] flex items-center justify-center cursor-pointer"
        onClick={() => {
          if (!preview && !isLoading && !disabled) {
            document.getElementById("file-input")?.click();
          }
        }}
        role="button"
        aria-label="Upload a photo of a textbook page"
        tabIndex={0}
        onKeyDown={(e) => {
          if (
            (e.key === "Enter" || e.key === " ") &&
            !preview &&
            !isLoading &&
            !disabled
          ) {
            e.preventDefault();
            document.getElementById("file-input")?.click();
          }
        }}
      >
        <input
          id="file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleInputChange}
          aria-label="Choose an image"
          disabled={isLoading || disabled}
        />

        {preview ? (
          <div className="relative w-full p-2">
            <img
              src={preview}
              alt="Textbook page preview"
              className="w-full max-h-56 object-contain rounded-lg"
            />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearImage();
              }}
              disabled={isLoading}
              className="absolute top-2 right-2 bg-white rounded-full p-2 shadow text-gray-500 hover:text-red-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Remove image"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 px-4 text-center">
            <div className="flex gap-4">
              <Camera className="text-orange-400" size={36} />
              <Upload className="text-orange-400" size={36} />
            </div>

            <p className="text-gray-600 font-medium">
              Take a photo or upload a textbook page
            </p>

            <p className="text-xs text-gray-400">
              JPG, PNG, or WebP supported
            </p>
          </div>
        )}
      </div>

      {/* Upload Error */}
      {uploadError && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 rounded-lg p-3"
        >
          {uploadError}
        </p>
      )}

      {/* Manual Text Toggle */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          disabled={isLoading || disabled}
          className="text-sm text-blue-600 underline min-h-[44px] px-2 disabled:opacity-50"
        >
          {showManual
            ? "Hide manual text input"
            : "Or type your question here"}
        </button>
      </div>

      {/* Manual Text Input */}
      {showManual && (
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Type or paste your textbook content here..."
          disabled={isLoading || disabled}
          className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[140px] resize-y focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
          aria-label="Textbook content"
        />
      )}

      {/* Explanation Language Selector */}
      <div className="space-y-1">
        <label
          htmlFor="language-select"
          className="block text-sm font-medium text-gray-700"
        >
          Explanation Language
        </label>

        <select
          id="language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          disabled={isLoading || disabled}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {LANGUAGES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Grade Selector */}
      <div className="space-y-1">
        <label
          htmlFor="grade-select"
          className="block text-sm font-medium text-gray-700"
        >
          Select Grade
        </label>

        <select
          id="grade-select"
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value) as Grade)}
          disabled={isLoading || disabled}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-lg transition-colors min-h-[52px] flex items-center justify-center gap-2"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating explanation...
          </>
        ) : (
          "Explain this page"
        )}
      </button>
    </div>
  );
}
