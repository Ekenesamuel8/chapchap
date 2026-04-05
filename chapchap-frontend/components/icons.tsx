type IconProps = {
  className?: string;
};

export function GoogleIcon({ className = "size-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M21.64 12.2045C21.64 11.3877 21.5668 10.6022 21.4309 9.84863H12V13.7241H17.3891C17.1573 14.9741 16.4527 16.0322 15.3945 16.7404V19.254H18.6309C20.5245 17.5104 21.64 14.9422 21.64 12.2045Z"
        fill="#4285F4"
      />
      <path
        d="M12 22C14.7 22 16.9636 21.1045 18.6309 19.254L15.3945 16.7404C14.4991 17.3404 13.3545 17.6954 12 17.6954C9.39545 17.6954 7.19091 15.9363 6.40455 13.5727H3.05818V16.1681C4.71636 19.4636 8.12727 22 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.40455 13.5727C6.20455 12.9727 6.09091 12.3318 6.09091 11.6727C6.09091 11.0136 6.20455 10.3727 6.40455 9.77274V7.17728H3.05818C2.37636 8.53637 2 10.0682 2 11.6727C2 13.2773 2.37636 14.8091 3.05818 16.1682L6.40455 13.5727Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.65C13.4773 5.65 14.8045 6.15909 15.8591 7.15909L18.7045 4.31364C16.9591 2.70909 14.6955 1.72727 12 1.72727C8.12727 1.72727 4.71636 4.26364 3.05818 7.17727L6.40455 9.77273C7.19091 7.40909 9.39545 5.65 12 5.65Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function CopyIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M9 9.75A2.25 2.25 0 0 1 11.25 7.5h7.5A2.25 2.25 0 0 1 21 9.75v9A2.25 2.25 0 0 1 18.75 21h-7.5A2.25 2.25 0 0 1 9 18.75v-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M15 7.5V5.25A2.25 2.25 0 0 0 12.75 3h-7.5A2.25 2.25 0 0 0 3 5.25v9a2.25 2.25 0 0 0 2.25 2.25H9"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function MicIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7A3.5 3.5 0 0 0 8.5 7v5a3.5 3.5 0 0 0 3.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PaperclipIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="m10.5 13.5 4.97-4.97a2.5 2.5 0 1 1 3.53 3.53l-6.73 6.74a4.5 4.5 0 0 1-6.37-6.37l7.44-7.43"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SendIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M21 3 10 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m21 3-7 18-4-7-7-4 18-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WalletIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M3 8.25A2.25 2.25 0 0 1 5.25 6h12A2.25 2.25 0 0 1 19.5 8.25V9H7.5A2.25 2.25 0 0 0 5.25 11.25v1.5A2.25 2.25 0 0 0 7.5 15h12v.75A2.25 2.25 0 0 1 17.25 18h-12A2.25 2.25 0 0 1 3 15.75v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M18 9h1.5A1.5 1.5 0 0 1 21 10.5v3a1.5 1.5 0 0 1-1.5 1.5H18A2.25 2.25 0 0 1 15.75 12.75v-1.5A2.25 2.25 0 0 1 18 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="18" cy="12" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function SuccessIcon({ className = "size-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m8.5 12.5 2.2 2.2 4.8-5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HistoryIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4.5 6.75h15M4.5 12h15M4.5 17.25h10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
