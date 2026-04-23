import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4">
    <div className="text-center">
      <h1 className="mb-2 text-5xl font-bold text-foreground">404</h1>
      <p className="mb-6 text-muted-foreground">
        We couldn&apos;t find the page you were looking for.
      </p>
      <Link
        to="/"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to the collection
      </Link>
    </div>
  </div>
);

export default NotFound;
