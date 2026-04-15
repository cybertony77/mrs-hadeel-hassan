import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Carousel } from '@mantine/carousel';

import ZoomableImage from '../ZoomableImage';

import { listQuestionPicturePublicIds } from '../../lib/questionPictures';

import classes from './QuestionImagesCarousel.module.css';



const HOVER_POLL_MS = 5000;



/**

 * Renders one ZoomableImage or a Mantine carousel when a question has multiple pictures.

 * @param {{ question?: object, imageUrls?: Record<string, string>, instanceKey?: string }} props

 */

export default function QuestionImagesCarousel({ question, imageUrls = {}, instanceKey = '' }) {

  const emblaApiRef = useRef(null);

  const slideInnerRefs = useRef([]);

  const hoverRef = useRef(false);

  const [showArrows, setShowArrows] = useState(false);

  const [emblaApi, setEmblaApi] = useState(null);

  /** Pixel height of viewport + container = active slide only (see syncViewportToActiveSlide). */
  const [viewportHeightPx, setViewportHeightPx] = useState(undefined);



  const resolved = useMemo(() => {

    const publicIds = listQuestionPicturePublicIds(question || {});

    return publicIds

      .map((id) => ({ id, url: imageUrls[id] }))

      .filter((item) => item.url);

  }, [question, imageUrls]);



  /**
   * Embla’s horizontal flex row makes the viewport as tall as the *tallest* slide.
   * We measure only the selected slide and set that height on viewport + container.
   */
  const syncViewportToActiveSlide = useCallback(() => {

    const api = emblaApiRef.current;

    if (!api || resolved.length < 2) return;

    const i = api.selectedScrollSnap();

    const el = slideInnerRefs.current[i];

    if (!el) return;

    const h = el.getBoundingClientRect().height;

    if (h > 0) setViewportHeightPx(Math.ceil(h));

  }, [resolved.length]);



  const handleSlideImageLoad = useCallback(() => {

    emblaApiRef.current?.reInit();

    queueMicrotask(() => syncViewportToActiveSlide());

  }, [syncViewportToActiveSlide]);



  useEffect(() => {

    const id = setInterval(() => {

      setShowArrows(hoverRef.current);

    }, HOVER_POLL_MS);

    return () => clearInterval(id);

  }, []);



  useEffect(() => {

    if (!emblaApi || resolved.length < 2) return;

    const onSelect = () => syncViewportToActiveSlide();

    const onReInit = () => syncViewportToActiveSlide();

    emblaApi.on('select', onSelect);

    emblaApi.on('reInit', onReInit);

    syncViewportToActiveSlide();

    return () => {

      emblaApi.off('select', onSelect);

      emblaApi.off('reInit', onReInit);

    };

  }, [emblaApi, resolved.length, syncViewportToActiveSlide]);



  useLayoutEffect(() => {

    if (resolved.length < 2) return;

    syncViewportToActiveSlide();

  }, [resolved.length, instanceKey, syncViewportToActiveSlide]);



  useLayoutEffect(() => {

    if (resolved.length < 2) return;

    const observers = [];

    for (let i = 0; i < resolved.length; i += 1) {

      const el = slideInnerRefs.current[i];

      if (!el) continue;

      const idx = i;

      const ro = new ResizeObserver(() => {

        if (emblaApiRef.current?.selectedScrollSnap() === idx) {

          syncViewportToActiveSlide();

        }

      });

      ro.observe(el);

      observers.push(ro);

    }

    return () => observers.forEach((o) => o.disconnect());

  }, [resolved.length, instanceKey, emblaApi, syncViewportToActiveSlide]);



  const handlePointerEnter = useCallback(() => {

    hoverRef.current = true;

    setShowArrows(true);

  }, []);



  const handlePointerLeave = useCallback(() => {

    hoverRef.current = false;

  }, []);



  if (resolved.length === 0) return null;



  const zoomStyle = { width: '100%', marginBottom: 0, maxWidth: '100%' };



  const carouselViewportStyle =

    viewportHeightPx != null

      ? { height: viewportHeightPx, overflow: 'hidden' }

      : { height: 'auto' };



  const carouselContainerStyle =

    viewportHeightPx != null

      ? { height: viewportHeightPx, alignItems: 'flex-start' }

      : { height: 'auto', alignItems: 'flex-start' };



  if (resolved.length === 1) {

    return (

      <div style={{ marginBottom: '24px', width: '100%', maxWidth: '100%' }}>

        <ZoomableImage

          key={`${instanceKey}-${resolved[0].id}`}

          src={resolved[0].url}

          alt="Question"

          style={zoomStyle}

        />

      </div>

    );

  }



  return (

    <div

      className={classes.carouselOuter}

      style={{ marginBottom: '24px', width: '100%', maxWidth: '100%' }}

      data-arrows-visible={showArrows ? 'true' : 'false'}

      onPointerEnter={handlePointerEnter}

      onPointerLeave={handlePointerLeave}

    >

      <Carousel

        key={instanceKey}

        withIndicators

        withControls

        height="auto"

        slideSize="100%"

        slideGap="md"

        getEmblaApi={(api) => {

          emblaApiRef.current = api;

          setEmblaApi(api);

        }}

        emblaOptions={{ loop: false, align: 'start' }}

        classNames={classes}

        styles={{

          root: { width: '100%', maxWidth: '100%' },

          viewport: carouselViewportStyle,

          container: carouselContainerStyle,

          slide: { height: 'auto' },

        }}

      >

        {resolved.map(({ id, url }, slideIndex) => (

          <Carousel.Slide key={id}>

            <div

              ref={(el) => {

                slideInnerRefs.current[slideIndex] = el;

              }}

              className={classes.slide}

            >

              <ZoomableImage

                src={url}

                alt="Question"

                style={zoomStyle}

                onImageLoad={handleSlideImageLoad}

              />

            </div>

          </Carousel.Slide>

        ))}

      </Carousel>

    </div>

  );

}
