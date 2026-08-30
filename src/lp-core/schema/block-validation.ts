/**
 * LP PRO™ Block Property Schema Validation
 * Uses Zod for runtime type safety on all 22 block types
 */

import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────────
// Base Schemas (reusable across blocks)
// ──────────────────────────────────────────────────────────────────────────

const ColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
  .optional();

const AnimationSchema = z.object({
  type: z.enum(['fade', 'slide', 'scale', 'bounce']).optional(),
  delay: z.number().min(0).max(2000).optional(),
  duration: z.number().min(100).max(5000).optional(),
}).optional();

const LinkSchema = z.object({
  text: z.string().min(1),
  href: z.string().url().optional(),
  target: z.enum(['_self', '_blank']).optional(),
}).optional();

const ImageSchema = z.object({
  src: z.string().url(),
  alt: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  placeholder: z.string().optional(), // LQIP base64
}).optional();

// ──────────────────────────────────────────────────────────────────────────
// Individual Block Schemas (22 types)
// ──────────────────────────────────────────────────────────────────────────

const HeroBlockSchema = z.object({
  type: z.literal('hero'),
  properties: z.object({
    title: z.string().min(1, 'Title required'),
    subtitle: z.string().optional(),
    background_color: ColorSchema,
    text_color: ColorSchema,
    bg_image: ImageSchema,
    cta_button: LinkSchema,
    height: z.enum(['small', 'medium', 'large']).default('large'),
    layout: z.enum(['left', 'center', 'right']).default('center'),
    animation: AnimationSchema,
  }),
});

const HeadlineBlockSchema = z.object({
  type: z.literal('headline'),
  properties: z.object({
    text: z.string().min(1, 'Headline required'),
    level: z.enum(['h1', 'h2', 'h3', 'h4']).default('h2'),
    alignment: z.enum(['left', 'center', 'right']).default('center'),
    color: ColorSchema,
    size: z.enum(['small', 'medium', 'large']).default('medium'),
    animation: AnimationSchema,
  }),
});

const FeaturesBlockSchema = z.object({
  type: z.literal('features'),
  properties: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    layout: z.enum(['grid', 'list', 'cards']).default('grid'),
    columns: z.number().min(1).max(4).default(3),
    features: z.array(z.object({
      id: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
      image: ImageSchema,
    })).min(1),
    animation: AnimationSchema,
  }),
});

const TestimonialBlockSchema = z.object({
  type: z.literal('testimonial'),
  properties: z.object({
    quote: z.string().min(1, 'Quote required'),
    author_name: z.string().min(1, 'Author name required'),
    author_role: z.string().optional(),
    author_image: ImageSchema,
    rating: z.number().min(1).max(5).optional(),
    animation: AnimationSchema,
  }),
});

const TestimonialsGridBlockSchema = z.object({
  type: z.literal('testimonials_grid'),
  properties: z.object({
    title: z.string().optional(),
    layout: z.enum(['grid', 'carousel']).default('grid'),
    columns: z.number().min(1).max(4).default(3),
    testimonials: z.array(z.object({
      id: z.string(),
      quote: z.string().min(1),
      author_name: z.string().min(1),
      author_role: z.string().optional(),
      author_image: ImageSchema,
    })).min(1),
    animation: AnimationSchema,
  }),
});

const VideoBlockSchema = z.object({
  type: z.literal('video'),
  properties: z.object({
    url: z.string().url('Invalid video URL'),
    title: z.string().optional(),
    autoplay: z.boolean().default(false),
    controls: z.boolean().default(true),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    thumbnail: ImageSchema,
    animation: AnimationSchema,
  }),
});

const ImageBlockSchema = z.object({
  type: z.literal('image'),
  properties: z.object({
    src: z.string().url('Invalid image URL'),
    alt: z.string().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    alignment: z.enum(['left', 'center', 'right']).default('center'),
    link: LinkSchema,
    animation: AnimationSchema,
  }),
});

const CTABlockSchema = z.object({
  type: z.literal('cta'),
  properties: z.object({
    text: z.string().min(1, 'Button text required'),
    href: z.string().url().optional(),
    background_color: ColorSchema,
    text_color: ColorSchema,
    size: z.enum(['small', 'medium', 'large']).default('medium'),
    style: z.enum(['solid', 'outline', 'ghost']).default('solid'),
    animation: AnimationSchema,
  }),
});

const DividerBlockSchema = z.object({
  type: z.literal('divider'),
  properties: z.object({
    style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
    color: ColorSchema,
    height: z.number().min(1).max(10).default(1),
    margin: z.number().min(0).max(100).default(20),
  }),
});

const FormBlockSchema = z.object({
  type: z.literal('form'),
  properties: z.object({
    form_id: z.string().uuid('Invalid form ID'),
    title: z.string().optional(),
    description: z.string().optional(),
    button_text: z.string().default('Enviar'),
    button_color: ColorSchema,
    animation: AnimationSchema,
  }),
});

const CountdownBlockSchema = z.object({
  type: z.literal('countdown'),
  properties: z.object({
    target_date: z.string().datetime().or(z.string().date()),
    title: z.string().optional(),
    color: ColorSchema,
    format: z.enum(['days_hours_minutes', 'hours_minutes_seconds']).default('days_hours_minutes'),
    animation: AnimationSchema,
  }),
});

const SocialProofBlockSchema = z.object({
  type: z.literal('social_proof'),
  properties: z.object({
    title: z.string().optional(),
    items: z.array(z.object({
      id: z.string(),
      text: z.string().min(1),
      icon: z.string().optional(),
      color: ColorSchema,
    })).min(1),
    layout: z.enum(['vertical', 'horizontal']).default('vertical'),
    animation: AnimationSchema,
  }),
});

const FAQBlockSchema = z.object({
  type: z.literal('faq'),
  properties: z.object({
    title: z.string().optional(),
    items: z.array(z.object({
      id: z.string(),
      question: z.string().min(1),
      answer: z.string().min(1),
    })).min(1),
    accordion_color: ColorSchema,
    animation: AnimationSchema,
  }),
});

const PricingBlockSchema = z.object({
  type: z.literal('pricing'),
  properties: z.object({
    title: z.string().optional(),
    plans: z.array(z.object({
      id: z.string(),
      name: z.string().min(1),
      price: z.string().min(1),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
      cta_text: z.string().optional(),
      cta_link: z.string().url().optional(),
      highlighted: z.boolean().default(false),
    })).min(1),
    columns: z.number().min(1).max(4).default(3),
    animation: AnimationSchema,
  }),
});

const StepsBlockSchema = z.object({
  type: z.literal('steps'),
  properties: z.object({
    title: z.string().optional(),
    steps: z.array(z.object({
      id: z.string(),
      number: z.number().positive(),
      title: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
    })).min(1),
    layout: z.enum(['vertical', 'horizontal']).default('vertical'),
    animation: AnimationSchema,
  }),
});

const TeamBlockSchema = z.object({
  type: z.literal('team'),
  properties: z.object({
    title: z.string().optional(),
    members: z.array(z.object({
      id: z.string(),
      name: z.string().min(1),
      role: z.string().optional(),
      bio: z.string().optional(),
      image: ImageSchema,
      social_links: z.array(z.object({
        platform: z.enum(['twitter', 'linkedin', 'github', 'instagram']),
        url: z.string().url(),
      })).optional(),
    })).min(1),
    columns: z.number().min(1).max(4).default(3),
    animation: AnimationSchema,
  }),
});

const LogoBarBlockSchema = z.object({
  type: z.literal('logo_bar'),
  properties: z.object({
    title: z.string().optional(),
    logos: z.array(z.object({
      id: z.string(),
      src: z.string().url(),
      alt: z.string().optional(),
      link: z.string().url().optional(),
    })).min(1),
    layout: z.enum(['horizontal', 'grid']).default('horizontal'),
    background_color: ColorSchema,
    animation: AnimationSchema,
  }),
});

const ServicesBlockSchema = z.object({
  type: z.literal('services'),
  properties: z.object({
    title: z.string().optional(),
    services: z.array(z.object({
      id: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
      image: ImageSchema,
    })).min(1),
    columns: z.number().min(1).max(4).default(3),
    animation: AnimationSchema,
  }),
});

const RichTextBlockSchema = z.object({
  type: z.literal('rich_text'),
  properties: z.object({
    html: z.string().min(1, 'Content required'),
    text_color: ColorSchema,
    background_color: ColorSchema,
    alignment: z.enum(['left', 'center', 'right']).default('left'),
    animation: AnimationSchema,
  }),
});

const TabsBlockSchema = z.object({
  type: z.literal('tabs'),
  properties: z.object({
    tabs: z.array(z.object({
      id: z.string(),
      label: z.string().min(1),
      content: z.string().min(1),
    })).min(1),
    background_color: ColorSchema,
    text_color: ColorSchema,
    animation: AnimationSchema,
  }),
});

const ComparisonTableBlockSchema = z.object({
  type: z.literal('comparison_table'),
  properties: z.object({
    title: z.string().optional(),
    headers: z.array(z.string().min(1)).min(2),
    rows: z.array(z.array(z.string())).min(1),
    highlight_column: z.number().optional(),
    animation: AnimationSchema,
  }),
});

const ProductGridBlockSchema = z.object({
  type: z.literal('product_grid'),
  properties: z.object({
    title: z.string().optional(),
    products: z.array(z.object({
      id: z.string(),
      name: z.string().min(1),
      price: z.string().optional(),
      image: ImageSchema,
      link: LinkSchema,
    })).min(1),
    columns: z.number().min(1).max(4).default(3),
    animation: AnimationSchema,
  }),
});

// ──────────────────────────────────────────────────────────────────────────
// Union of all block schemas
// ──────────────────────────────────────────────────────────────────────────

export const LpBlockValidationSchema = z.union([
  HeroBlockSchema,
  HeadlineBlockSchema,
  FeaturesBlockSchema,
  TestimonialBlockSchema,
  TestimonialsGridBlockSchema,
  VideoBlockSchema,
  ImageBlockSchema,
  CTABlockSchema,
  DividerBlockSchema,
  FormBlockSchema,
  CountdownBlockSchema,
  SocialProofBlockSchema,
  FAQBlockSchema,
  PricingBlockSchema,
  StepsBlockSchema,
  TeamBlockSchema,
  LogoBarBlockSchema,
  ServicesBlockSchema,
  RichTextBlockSchema,
  TabsBlockSchema,
  ComparisonTableBlockSchema,
  ProductGridBlockSchema,
]);

export type LpBlockValidation = z.infer<typeof LpBlockValidationSchema>;

/**
 * Validate a single block
 * @throws ZodError if validation fails
 */
export function validateBlock(block: unknown) {
  return LpBlockValidationSchema.parse(block);
}

/**
 * Safely validate a block (returns errors instead of throwing)
 */
export function validateBlockSafe(block: unknown) {
  const result = LpBlockValidationSchema.safeParse(block);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten().fieldErrors,
    };
  }
  return { valid: true, data: result.data };
}

/**
 * Validate an array of blocks
 */
export function validateBlocks(blocks: unknown[]) {
  return z.array(LpBlockValidationSchema).parse(blocks);
}

export function validateBlocksSafe(blocks: unknown[]) {
  const result = z.array(LpBlockValidationSchema).safeParse(blocks);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }
  return { valid: true, data: result.data };
}
