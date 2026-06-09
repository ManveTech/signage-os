import { ComponentType } from 'react';

export interface ServiceItem {
  id: string;
  iconName: string; // Dynamic icon name lookup or direct passing
  title: string;
  desc: string;
}

export interface IndustryItem {
  name: string;
  iconName: string;
}

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
}

export interface StatItem {
  value: string;
  label: string;
  desc: string;
}

export interface FeatureItem {
  title: string;
  desc: string;
}

export interface ProcessItem {
  step: string;
  title: string;
  desc: string;
}
