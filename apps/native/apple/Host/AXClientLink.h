#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// What the `AXClient` native module asks of the app. The module is Objective-C++, as a
/// React Native module must be; the app is Swift. This header is all the two share.
/// `startJSON` is called on the JavaScript thread and must answer at once; the rest
/// arrive on the module's queue, in order.
@protocol AXClientServices <NSObject>
- (void)libraryConnectedWithBridgeVersion:(NSInteger)bridgeVersion;
- (void)storeChanged:(NSString *)storeName snapshotJSON:(NSString *)snapshotJSON;
- (void)callAnswered:(NSInteger)callId result:(nullable NSString *)result error:(nullable NSString *)error;
/// `{ screen?, theme? }` as JSON, or nil to start on the first screen.
- (nullable NSString *)startJSON;
@end

/// The module, as the app sees it: what the host says to the library.
@protocol AXClientEmitter <NSObject>
/// "getSnapshot" with a store's name, or "dispatch" with an action as JSON.
- (void)call:(NSInteger)callId operation:(NSString *)operation argument:(NSString *)argument;
@end

@interface AXClientLink : NSObject
/// Set before the runtime starts, and not after.
@property (class, nonatomic, strong, nullable) id<AXClientServices> services;
/// The module, once React Native has given it the means to send an event. Nil before.
@property (class, nonatomic, readonly, nullable) id<AXClientEmitter> emitter;
@end

NS_ASSUME_NONNULL_END
