import { Link } from "react-router-dom";
import { Narrow } from "../components/layout";

export function NotFound() {
  return (
    <Narrow>
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-muted">
        The page you are looking for does not exist.{" "}
        <Link to="/" className="font-medium text-accent hover:underline">
          Go to the quotation builder
        </Link>
        .
      </p>
    </Narrow>
  );
}
