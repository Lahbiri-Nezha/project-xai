import PromoBanner from "@/components/layout/PromoBanner";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FloatingHelp from "@/components/layout/FloatingHelp";
import HeroSection from "@/components/landing/HeroSection";
import LogoStrip from "@/components/landing/LogoStrip";
import FeaturesSection from "@/components/landing/FeaturesSection";
import StatsSection from "@/components/landing/StatsSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import WaitlistSection from "@/components/landing/WaitlistSection";
import CTASection from "@/components/landing/CTASection";
import ScrollProgress from "@/components/shared/ScrollProgress";
import CustomCursor from "@/components/shared/CustomCursor";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <ScrollProgress />
      <CustomCursor />
      <PromoBanner />
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <LogoStrip />
        <FeaturesSection />
        <StatsSection />
        <TestimonialsSection />
        <WaitlistSection />
        <CTASection />
      </main>
      <Footer />
      <FloatingHelp />
    </div>
  );
}
