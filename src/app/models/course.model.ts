export interface Course {
  courseId: number;
  title: string;
  description?: string;
  price: number;
  imageUrl?: string;
  duration?: number;
  level?: string;
  category?: string;
  instructorName?: string;
  createdAt?: string;
  updatedAt?: string;
}
