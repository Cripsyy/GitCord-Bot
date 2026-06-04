type FormErrorProps = {
  message: string | null | undefined;
};

export default function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <p className="mt-3 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">
      {message}
    </p>
  );
}
