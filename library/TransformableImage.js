'use strict';

import PropTypes from 'prop-types';
import React from 'react';
import { Image, View } from 'react-native';
import Video from 'react-native-video';

import ViewTransformer from 'react-native-view-transformer';

let DEV = false;

export default class TransformableImage extends React.Component {

  static enableDebug() {
    DEV = true;
  }

  static propTypes = {
    pixels: PropTypes.shape({
      width: PropTypes.number,
      height: PropTypes.number,
    }),

    enableTransform: PropTypes.bool,
    enableScale: PropTypes.bool,
    enableTranslate: PropTypes.bool,
    LoadingComponent: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]),
    onSingleTapConfirmed: PropTypes.func,
    onTransformGestureReleased: PropTypes.func,
    onViewTransformed: PropTypes.func
  };

  static defaultProps = {
    enableTransform: true,
    enableScale: true,
    enableTranslate: true
  };

  constructor(props) {
    super(props);

    this.state = {
      width: 0,
      height: 0,

      imageLoaded: false,
      pixels: undefined,
      keyAcumulator: 1
    };
  }

  componentDidMount() {
    if (!this.props.pixels) {
      this.getImageSize(this.props.source);
    }
  }

  componentDidUpdate(prevProps) {
    if (!sameSource(prevProps.source, this.props.source)) {
      //image source changed, clear last image's pixels info if any
      this.setState({pixels: undefined, keyAcumulator: this.state.keyAcumulator + 1})
      this.getImageSize(this.props.source);
    }
  }

  _isVideo = uri => {
    const videoExtensions = [/.mp4$/g];
    return videoExtensions.some(extension => extension.test(uri));
  }

  render() {
    let maxScale = 1;
    let contentAspectRatio = undefined;
    let width, height; //pixels

    if (this.props.pixels) {
      //if provided via props
      width = this.props.pixels.width;
      height = this.props.pixels.height;
    } else if (this.state.pixels) {
      //if got using Image.getSize()
      width = this.state.pixels.width;
      height = this.state.pixels.height;
    }

    if (width && height) {
      contentAspectRatio = width / height;
      if (this.state.width && this.state.height) {
        maxScale = Math.max(width / this.state.width, height / this.state.height);
        maxScale = Math.max(1, maxScale);
      }
    }

    const viewTransformerDelegation = Object.keys(ViewTransformer.propTypes).reduce(
      (acc, prop) => (this.props[prop] !== undefined ? { ...acc, [prop]: this.props[prop] } : acc), {}
    );

    const imageOrVideo = this._isVideo(this.props.source.uri) ? (
      <Video
        style={this.props.style}
        source={this.props.source}
        resizeMode='contain'
        onLoadStart={this.onLoadStart.bind(this)}
        onLoad={this.onLoad.bind(this)}
        selectedAudioTrack={{ type: 'disabled' }}
        repeat
      />
    ) : (
      <Image
        {...this.props}
        style={[this.props.style, {backgroundColor: 'transparent'}]}
        resizeMode={'contain'}
        onLoadStart={this.onLoadStart.bind(this)}
        onLoad={this.onLoad.bind(this)}
        capInsets={{left: 0.1, top: 0.1, right: 0.1, bottom: 0.1}} //on iOS, use capInsets to avoid image downsampling
      />
    );

    return (
      <ViewTransformer
        ref='viewTransformer'
        key={'viewTransformer#' + this.state.keyAccumulator} //when image source changes, we should use a different node to avoid reusing previous transform state
        enableResistance={true}
        maxScale={maxScale}
        contentAspectRatio={contentAspectRatio}
        onLayout={this.onLayout.bind(this)}
        {...viewTransformerDelegation}
        enableTransform={this.props.enableTransform && this.state.imageLoaded} //disable transform until image is loaded
        style={this.props.style}>
        {!this.state.imageLoaded && this.props.LoadingComponent && (
          <View style={this.props.style}>
            {this.props.LoadingComponent}
          </View>
        )}
        {imageOrVideo}
      </ViewTransformer>
    );
  }

  onLoadStart(e) {
    this.props.onLoadStart && this.props.onLoadStart(e);
    this.setState({
      imageLoaded: false
    });
  }

  onLoad(e) {
    this.props.onLoad && this.props.onLoad(e);
    this.setState({
      imageLoaded: true
    });
  }

  onLayout(e) {
    let {width, height} = e.nativeEvent.layout;
    if (this.state.width !== width || this.state.height !== height) {
      this.setState({
        width: width,
        height: height
      });
    }
  }

  getImageSize(source) {
    if(!source) return;

    DEV && console.log('getImageSize...' + JSON.stringify(source));

    if (typeof Image.getSize === 'function') {
      if (source && source.uri) {
        Image.getSize(
          source.uri,
          (width, height) => {
            DEV && console.log('getImageSize...width=' + width + ', height=' + height);
            if (width && height) {
              if(this.state.pixels && this.state.pixels.width === width && this.state.pixels.height === height) {
                //no need to update state
              } else {
                this.setState({pixels: {width, height}});
              }
            }
          },
          (error) => {
            console.error('getImageSize...error=' + JSON.stringify(error) + ', source=' + JSON.stringify(source));
          })
      } else {
        console.warn('getImageSize...please provide pixels prop for local images');
      }
    } else {
      console.warn('getImageSize...Image.getSize function not available before react-native v0.28');
    }
  }

  getViewTransformerInstance() {
    return this.refs['viewTransformer'];
  }
}

function sameSource(source, nextSource) {
  if (source === nextSource) {
    return true;
  }
  if (source && nextSource) {
    if (source.uri && nextSource.uri) {
      return source.uri === nextSource.uri;
    }
  }
  return false;
}
