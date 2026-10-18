import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { LivePreview } from "@/components/landing/LivePreview";
import { CTA, Categories, Features, Footer, Pipeline, Privacy, ProblemSolution, Targets } from "@/components/landing/Sections";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <ProblemSolution />
      <Pipeline />
      <LivePreview />
      <Features />
      <Categories />
      <Targets />
      <Privacy />
      <CTA />
      <Footer />
    </main>
  );
}
