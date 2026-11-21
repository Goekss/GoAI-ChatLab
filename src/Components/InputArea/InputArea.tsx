import { useRef, useEffect, ChangeEvent, KeyboardEvent, Dispatch, SetStateAction } from "react";
import { AiOutlineSend } from "react-icons/ai";
import { BsPlusSquareDotted, BsStopFill } from "react-icons/bs";

interface InputAreaProps {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  onSend: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  canSend: boolean;
  stop: () => void;
  isSending: boolean;
  onFilesSelected: (files: File[]) => void;
  selectedFiles?: File[];
  onRemoveFile: (index: number) => void;
}

export default function InputArea({
  input,
  setInput,
  onSend,
  onKeyDown,
  canSend,
  stop,
  isSending,
  onFilesSelected,
  selectedFiles = [],
  onRemoveFile
}: InputAreaProps) {

  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [input]);

  function openFileDialog() {
    fileRef.current?.click();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesSelected?.(files);
    e.target.value = "";
  }

  return (
    <div className="composer">

      <div className="composerInner">

        {/* FILE CHIPS INPUT İÇİNDE */}
        {selectedFiles.length > 0 && (
          <div className="fileChips">
            {selectedFiles.map((f, i) => {

              const isImg = f.type.startsWith("image/");
              const url = isImg ? URL.createObjectURL(f) : undefined;

              return (
                <div key={`${f.name}-${i}`} className="fileChip">

                  {isImg ? (
                    <img
                      src={url}
                      alt=""
                      style={{
                        width: 28,
                        height: 28,
                        objectFit: "cover",
                        borderRadius: 6
                      }}
                    />
                  ) : (
                    <strong>
                      {f.name.split(".").pop()?.toUpperCase()}
                    </strong>
                  )}

                  <span>{f.name}</span>

                  <button
                    className="fileChipRemove"
                    onClick={() => onRemoveFile?.(i)}
                  >
                    ×
                  </button>

                </div>
              );
            })}
          </div>
        )}

        {/* INPUT ROW */}
        <div className="composerRow">

          <textarea
            ref={textareaRef}
            className="composerTextarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Schreiben Sie etwas ..."
            rows={1}
          />

          <div className="composerActions">

            <button
              type="button"
              className="iconBtn"
              onClick={openFileDialog}
            >
              <BsPlusSquareDotted size={18} />
            </button>

            <button
              type="button"
              className={`sendBtn ${isSending ? "stopMode" : ""}`} 
              onClick={isSending ? stop : onSend} 
              disabled={!isSending && !canSend}  
              
            >

                {isSending ? <BsStopFill size={16} className="stop-icon"/> : <AiOutlineSend size={16} />} 
              
            </button>

          </div>

        </div>

      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.docx"
        onChange={handleFileChange}
        hidden
      />

    </div>
  );
}