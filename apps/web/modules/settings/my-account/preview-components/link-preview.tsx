interface Props {
  base64?: string;
}

export default function LinkPreview({ base64 }: Props) {
  return (
    <>
      <div className="border-subtle rounded-md border" />
      <div className="border-subtle flex w-full flex-col items-center justify-end border p-4">
        <div className="relative aspect-square w-[300px] overflow-hidden shadow-lg">
          {/* Background image */}
          <img
            src="/links-preview/social-bg-dark-lines.jpg"
            alt="Background"
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Overlay content */}
          <div className="relative z-10 flex h-full flex-col justify-between p-6 text-black">
            {/* Top Section */}
            <div className="flex items-center justify-between">
              {/* OneHash Logo */}
              <img src={base64} alt="OneHash Logo" className="h-6" />

              {/* User Icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                <svg className="h-6 w-6 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm0 2c-5.33 0-8 2.667-8 4v2h16v-2c0-1.333-2.67-4-8-4z" />
                </svg>
              </div>
            </div>

            {/* Center Text */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold">Meet Manas Santosh Laud</h2>
              <p className="mt-1 text-sm text-gray-700">Quick Chat</p>
            </div>

            {/* Bottom Section */}
          </div>
        </div>
        <div className="mt-auto h-[120px] w-[300px] border border-gray-300 bg-white bg-opacity-80 pt-4">
          <p className="text-xs text-gray-500">CAL.ID</p>
          <h3 className="mt-1 font-semibold text-gray-800">Quick Chat | Manas Santosh Laud | OneHash Cal</h3>
          <p className="mt-1 text-sm text-gray-500">Quick Chat</p>
        </div>
      </div>
    </>
  );
}
